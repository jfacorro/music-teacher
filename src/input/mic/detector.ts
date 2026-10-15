/**
 * Single-note detection from microphone audio (PLAN.md §5.2). Pure DSP, fed fixed-size hops of
 * samples, so it's testable with synthesized signals.
 *
 * Per hop (~11 ms at 48 kHz):
 * 1. Level: RMS in dBFS. Nothing quieter than the gate (noise floor + sensitivity) counts.
 * 2. Onset: the level jumps by `onsetRiseDb` over the recent minimum. This separates repeated
 *    presses of the same key. The onset hop's time becomes the note's time.
 * 3. Pitch: McLeod pitch method (pitchy) over the last `windowSize` samples.
 * 4. Stabilizer: a pitch must repeat for `stableFrames` hops before a Note On, which filters the
 *    octave jumps common at piano attacks.
 * 5. Note Off: the level stays under the gate for `releaseFrames` hops, or a new onset starts.
 */
import { PitchDetector } from 'pitchy';
import { NoteEventType } from '../types';

const DetectorPhase = {
  Idle: 'idle',
  Attack: 'attack',
  Sounding: 'sounding',
} as const;
type DetectorPhase = (typeof DetectorPhase)[keyof typeof DetectorPhase];

export interface DetectorOptions {
  sampleRate: number;
  /** Minimum level (dBFS) for a sound to count: noise floor + sensitivity. */
  gateDb: number;
  windowSize?: number;
  hopSize?: number;
  /** Lowest and highest MIDI notes to report (default C2–C7). */
  minMidi?: number;
  maxMidi?: number;
  /** pitchy clarity (0–1) needed to trust a pitch. */
  minClarity?: number;
  onsetRiseDb?: number;
  stableFrames?: number;
  releaseFrames?: number;
}

export interface DetectedNote {
  type: NoteEventType;
  midi: number;
  velocity: number;
  /** Seconds, on the same timeline as the `time` passed to `process`. */
  time: number;
}

export interface PitchReading {
  midi: number;
  clarity: number;
  /** How far from the nearest key, in cents. */
  cents: number;
}

const DEFAULTS = {
  windowSize: 2048,
  hopSize: 512,
  minMidi: 36, // C2
  maxMidi: 96, // C7
  minClarity: 0.9,
  onsetRiseDb: 6,
  stableFrames: 2,
  releaseFrames: 3,
};

/** Hops of recent levels an onset must rise above. */
const ONSET_LOOKBACK = 5;
/**
 * Minimum hops between two onsets (~100 ms). A real piano's sound keeps building for tens of
 * milliseconds after the hammer strikes, which would otherwise look like a second onset.
 * Fast sixteenth notes at 120 BPM are still 125 ms apart.
 */
const MIN_ONSET_GAP = 9;
/** Give up on an attack that never settles on a pitch (e.g. a knock). */
const MAX_ATTACK_FRAMES = 15;
/** Allowed distance from a key's exact pitch. */
const MAX_CENTS = 45;
/** Extra stable hops required to switch notes without an onset (legato). */
const LEGATO_EXTRA_FRAMES = 4;
/**
 * Extra stable hops required when a new attack shows the pitch that was already ringing:
 * the previous note often dominates for a moment before the new one takes over.
 */
const RINGING_EXTRA_FRAMES = 2;
/**
 * At an attack, a pitch heard with less clarity than this needs extra hops: the first readings
 * of a piano note are often an octave too high before settling.
 */
const CONFIDENT_CLARITY = 0.95;
const UNSURE_EXTRA_FRAMES = 1;
/** After a note ends, the same pitch can't start again on its own (without an onset) this soon. */
const RELEASE_HOLD_S = 0.5;
/** Level above the gate that maps to full velocity. */
const VELOCITY_RANGE_DB = 40;

type Phase =
  | { kind: typeof DetectorPhase.Idle }
  | {
      kind: typeof DetectorPhase.Attack;
      time: number;
      peakDb: number;
      frames: number;
      ringing: number | null;
    }
  | { kind: typeof DetectorPhase.Sounding; midi: number; quietFrames: number };

export class NoteDetector {
  private readonly options: Required<DetectorOptions>;
  private readonly pitch: PitchDetector<Float32Array>;
  private readonly window: Float32Array;
  private filled = 0;
  private readonly levels: number[] = [];
  private hopsSinceOnset = Infinity;
  private phase: Phase = { kind: DetectorPhase.Idle };
  private candidate: { midi: number; count: number; time: number; clarity: number } | null = null;
  private released: { midi: number; time: number } | null = null;

  /** Latest level and pitch, for meters and live display. */
  levelDb = -Infinity;
  reading: PitchReading | null = null;

  constructor(options: DetectorOptions) {
    this.options = { ...DEFAULTS, ...options };
    this.pitch = PitchDetector.forFloat32Array(this.options.windowSize);
    this.window = new Float32Array(this.options.windowSize);
  }

  set gateDb(value: number) {
    this.options.gateDb = value;
  }

  get hopSize(): number {
    return this.options.hopSize;
  }

  /** Feeds one hop of samples that starts at `time` (seconds). Returns note events. */
  process(samples: Float32Array, time: number): DetectedNote[] {
    const { hopSize, windowSize, gateDb, onsetRiseDb, sampleRate } = this.options;
    if (samples.length !== hopSize) {
      throw new Error(`Expected ${hopSize} samples, got ${samples.length}`);
    }
    this.window.copyWithin(0, hopSize);
    this.window.set(samples, windowSize - hopSize);
    this.filled = Math.min(windowSize, this.filled + hopSize);

    const db = levelDb(samples);
    this.levelDb = db;
    const recentMin = this.levels.length > 0 ? Math.min(...this.levels) : -Infinity;
    this.levels.push(db);
    if (this.levels.length > ONSET_LOOKBACK) this.levels.shift();

    const events: DetectedNote[] = [];
    const onset =
      db >= gateDb && db - recentMin >= onsetRiseDb && this.hopsSinceOnset >= MIN_ONSET_GAP;
    if (onset) {
      const onsetTime = time + attackOffset(samples) / sampleRate;
      if (this.phase.kind === DetectorPhase.Sounding) events.push(off(this.phase.midi, onsetTime));
      const ringing = this.phase.kind === DetectorPhase.Sounding ? this.phase.midi : null;
      this.phase = { kind: DetectorPhase.Attack, time: onsetTime, peakDb: db, frames: 0, ringing };
      this.candidate = null;
      this.hopsSinceOnset = 0;
      // The next onset must rise above this note, not above the silence before it (or the
      // onset hop, which the attack only partly fills).
      this.levels.length = 0;
    } else {
      this.hopsSinceOnset++;
    }

    this.updateCandidate(db, time, sampleRate);
    this.advance(db, time, events);
    return events;
  }

  private updateCandidate(db: number, time: number, sampleRate: number): void {
    const { windowSize, gateDb, minClarity, minMidi, maxMidi } = this.options;
    this.reading = null;
    if (this.filled < windowSize || db < gateDb) {
      this.candidate = null;
      return;
    }
    const [frequency, clarity] = this.pitch.findPitch(this.window, sampleRate);
    const exact = 69 + 12 * Math.log2(frequency / 440);
    const midi = Math.round(exact);
    const cents = (exact - midi) * 100;
    if (!Number.isFinite(exact) || clarity < minClarity || midi < minMidi || midi > maxMidi) {
      this.candidate = null;
      return;
    }
    this.reading = { midi, clarity, cents };
    if (Math.abs(cents) > MAX_CENTS) {
      this.candidate = null;
    } else if (this.candidate?.midi === midi) {
      this.candidate.count++;
      this.candidate.clarity = clarity;
    } else {
      this.candidate = { midi, count: 1, time, clarity };
    }
  }

  private advance(db: number, time: number, events: DetectedNote[]): void {
    const { stableFrames, releaseFrames, gateDb, hopSize, sampleRate } = this.options;
    const candidate = this.candidate;
    const phase = this.phase;

    switch (phase.kind) {
      case DetectorPhase.Attack:
        phase.frames++;
        phase.peakDb = Math.max(phase.peakDb, db);
        if (
          candidate &&
          candidate.count >=
            stableFrames +
              (candidate.midi === phase.ringing ? RINGING_EXTRA_FRAMES : 0) +
              (candidate.clarity < CONFIDENT_CLARITY ? UNSURE_EXTRA_FRAMES : 0)
        ) {
          events.push(on(candidate.midi, phase.time, velocityFor(phase.peakDb, gateDb)));
          this.phase = { kind: DetectorPhase.Sounding, midi: candidate.midi, quietFrames: 0 };
        } else if (phase.frames > MAX_ATTACK_FRAMES) {
          this.phase = { kind: DetectorPhase.Idle };
        }
        break;

      case DetectorPhase.Idle: {
        // A soft attack can slip under the onset detector; accept a clearly stable pitch,
        // unless it's the note that just ended, still fading.
        const fading =
          candidate !== null &&
          this.released !== null &&
          this.released.midi === candidate.midi &&
          time - this.released.time < RELEASE_HOLD_S;
        if (candidate && candidate.count >= stableFrames + 1 && !fading) {
          events.push(on(candidate.midi, candidate.time, velocityFor(db, gateDb)));
          this.phase = { kind: DetectorPhase.Sounding, midi: candidate.midi, quietFrames: 0 };
        }
        break;
      }

      case DetectorPhase.Sounding:
        if (db < gateDb) {
          phase.quietFrames++;
          if (phase.quietFrames >= releaseFrames) {
            const quietSince = time - ((releaseFrames - 1) * hopSize) / sampleRate;
            events.push(off(phase.midi, quietSince));
            this.released = { midi: phase.midi, time };
            this.phase = { kind: DetectorPhase.Idle };
          }
          break;
        }
        phase.quietFrames = 0;
        // Legato: a different, steady pitch without an onset. Octave jumps are more likely
        // detection errors on a ringing note than a real change, so they don't count.
        if (
          candidate &&
          candidate.midi !== phase.midi &&
          Math.abs(candidate.midi - phase.midi) % 12 !== 0 &&
          candidate.count >= stableFrames + LEGATO_EXTRA_FRAMES
        ) {
          events.push(off(phase.midi, candidate.time));
          events.push(on(candidate.midi, candidate.time, velocityFor(db, gateDb)));
          this.phase = { kind: DetectorPhase.Sounding, midi: candidate.midi, quietFrames: 0 };
        }
        break;
    }
  }
}

/** Index of the attack inside a hop: the first sample reaching a quarter of the hop's peak. */
function attackOffset(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const threshold = peak * 0.25;
  const index = samples.findIndex((sample) => Math.abs(sample) >= threshold);
  return Math.max(0, index);
}

export function levelDb(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return 10 * Math.log10(sum / samples.length + 1e-20);
}

function velocityFor(peakDb: number, gateDb: number): number {
  const ratio = (peakDb - gateDb) / VELOCITY_RANGE_DB;
  return Math.max(1, Math.min(127, Math.round(20 + ratio * 107)));
}

function on(midi: number, time: number, velocity: number): DetectedNote {
  return { type: NoteEventType.On, midi, velocity, time };
}

function off(midi: number, time: number): DetectedNote {
  return { type: NoteEventType.Off, midi, velocity: 0, time };
}
