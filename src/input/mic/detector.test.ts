import { describe, expect, it } from 'vitest';
import { NoteDetector, levelDb, type DetectedNote } from './detector';
import { NoteEventType } from '../types';

const SAMPLE_RATE = 48_000;
const HOP = 512;
/** Background noise at about -64 dBFS; the gate sits 12 dB above it. */
const NOISE = 0.001;
const GATE_DB = -52;

interface ToneSpec {
  midi: number;
  start: number;
  /** Key held for this long; then the damper stops the string quickly. */
  duration: number;
  amplitude?: number;
}

/** Piano-like tones: harmonics, a 5 ms attack, natural decay, then a fast damper release. */
function render(tones: ToneSpec[], seconds: number, seed = 1): Float32Array {
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  const harmonics = [1, 0.6, 0.4, 0.25, 0.15, 0.1];
  for (const { midi, start, duration, amplitude = 0.3 } of tones) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const from = Math.round(start * SAMPLE_RATE);
    for (let i = from; i < out.length; i++) {
      const t = (i - from) / SAMPLE_RATE;
      let envelope = t < 0.005 ? t / 0.005 : Math.exp(-2.5 * (t - 0.005));
      if (t > duration) envelope *= Math.exp(-40 * (t - duration));
      if (t > 0.01 && envelope < 1e-5) break;
      let value = 0;
      harmonics.forEach((weight, h) => {
        value += weight * Math.sin(2 * Math.PI * frequency * (h + 1) * t);
      });
      out[i]! += (amplitude * envelope * value) / 2;
    }
  }
  // Deterministic noise.
  let state = seed;
  for (let i = 0; i < out.length; i++) {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    out[i]! += NOISE * (state / 2 ** 30 - 1) * Math.sqrt(3);
  }
  return out;
}

function detect(signal: Float32Array, gateDb = GATE_DB): DetectedNote[] {
  const detector = new NoteDetector({ sampleRate: SAMPLE_RATE, gateDb });
  const events: DetectedNote[] = [];
  for (let i = 0; i + HOP <= signal.length; i += HOP) {
    events.push(...detector.process(signal.subarray(i, i + HOP), i / SAMPLE_RATE));
  }
  return events;
}

const ons = (events: DetectedNote[]) => events.filter((e) => e.type === NoteEventType.On);

describe('NoteDetector', () => {
  it('detects a single note with its onset time and releases it', () => {
    const events = detect(render([{ midi: 69, start: 0.2, duration: 0.5 }], 1.5));
    expect(events.map((e) => [e.type, e.midi])).toEqual([
      ['on', 69],
      ['off', 69],
    ]);
    const [noteOn, noteOff] = events as [DetectedNote, DetectedNote];
    expect(Math.abs(noteOn.time - 0.2)).toBeLessThan(0.005); // within 5 ms, well under a hop
    expect(noteOff.time).toBeGreaterThan(0.6);
    expect(noteOff.time).toBeLessThan(0.9);
  });

  it.each([
    [36, 'C2'],
    [48, 'C3'],
    [60, 'C4'],
    [64, 'E4'],
    [72, 'C5'],
    [84, 'C6'],
    [96, 'C7'],
  ])('detects MIDI %i (%s)', (midi) => {
    expect(
      ons(detect(render([{ midi, start: 0.1, duration: 0.6 }], 1))).map((e) => e.midi),
    ).toEqual([midi]);
  });

  it('follows a melody', () => {
    const melody = [60, 62, 64, 65, 67].map((midi, i) => ({
      midi,
      start: 0.1 + i * 0.4,
      duration: 0.3,
    }));
    const found = ons(detect(render(melody, 2.4)));
    expect(found.map((e) => e.midi)).toEqual([60, 62, 64, 65, 67]);
    found.forEach((event, i) => {
      expect(Math.abs(event.time - melody[i]!.start)).toBeLessThan(0.005);
    });
  });

  it('separates repeated presses of the same key', () => {
    const repeated = [0.1, 0.5, 0.9].map((start) => ({ midi: 64, start, duration: 0.3 }));
    expect(ons(detect(render(repeated, 1.5))).map((e) => e.midi)).toEqual([64, 64, 64]);
  });

  it('re-strikes a key while the previous note still rings', () => {
    const events = detect(
      render(
        [
          { midi: 67, start: 0.1, duration: 2, amplitude: 0.15 },
          { midi: 67, start: 0.7, duration: 0.5, amplitude: 0.45 },
        ],
        1.6,
      ),
    );
    expect(events.map((e) => e.type + e.midi)).toEqual(['on67', 'off67', 'on67', 'off67']);
  });

  it('ignores background noise', () => {
    expect(detect(render([], 1))).toEqual([]);
  });

  it('ignores notes quieter than the gate', () => {
    expect(detect(render([{ midi: 60, start: 0.1, duration: 0.5, amplitude: 0.002 }], 1))).toEqual(
      [],
    );
  });

  it('gives louder notes higher velocities', () => {
    const [soft] = ons(
      detect(render([{ midi: 60, start: 0.1, duration: 0.5, amplitude: 0.02 }], 1)),
    );
    const [loud] = ons(
      detect(render([{ midi: 60, start: 0.1, duration: 0.5, amplitude: 0.6 }], 1)),
    );
    expect(soft!.velocity).toBeLessThan(loud!.velocity);
  });

  it('reports the live level and pitch for meters', () => {
    const detector = new NoteDetector({ sampleRate: SAMPLE_RATE, gateDb: GATE_DB });
    const signal = render([{ midi: 69, start: 0, duration: 1 }], 0.3);
    for (let i = 0; i + HOP <= signal.length; i += HOP) {
      detector.process(signal.subarray(i, i + HOP), i / SAMPLE_RATE);
    }
    expect(detector.levelDb).toBeGreaterThan(-30);
    expect(detector.reading?.midi).toBe(69);
    expect(Math.abs(detector.reading?.cents ?? 99)).toBeLessThan(5);
  });

  it('rejects hops of the wrong size', () => {
    const detector = new NoteDetector({ sampleRate: SAMPLE_RATE, gateDb: GATE_DB });
    expect(() => detector.process(new Float32Array(100), 0)).toThrow(/512/);
  });
});

describe('levelDb', () => {
  it('measures RMS level in dBFS', () => {
    expect(levelDb(new Float32Array(512).fill(1))).toBeCloseTo(0);
    expect(levelDb(new Float32Array(512).fill(0.1))).toBeCloseTo(-20);
    expect(levelDb(new Float32Array(512))).toBeLessThan(-150);
  });
});
