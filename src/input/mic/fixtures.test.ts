/**
 * Replays real piano recordings (fixtures/mic/*.json, saved from Settings → Microphone
 * check) through the note detector and compares it with the MIDI notes played at
 * the same time. Prints a report per recording; fails if accuracy drops below the
 * recording's `minAccuracy` (set once a baseline is known).
 */
import { describe, expect, it } from 'vitest';
import { compare, type TimedNote } from './calibration';
import { NoteDetector } from './detector';
import type { RecordingFile } from './recording';
import { bytesFromDataUrl, decodeWav } from './wav';
import { Instrument } from '../routing';
import { NoteEventType } from '../types';

type Fixture = RecordingFile & { minAccuracy?: number };

const metas = import.meta.glob<Fixture>('/fixtures/mic/*.json', { eager: true, import: 'default' });
const recordings = Object.keys(metas).map((path) => path.replace(/\.json$/, ''));

const HOP = 512;

function replay(fixture: Fixture): TimedNote[] {
  const { samples, sampleRate } = decodeWav(bytesFromDataUrl(fixture.audio));
  const detector = new NoteDetector({ sampleRate, gateDb: fixture.gateDb, hopSize: HOP });
  const detected: TimedNote[] = [];
  for (let i = 0; i + HOP <= samples.length; i += HOP) {
    for (const event of detector.process(samples.subarray(i, i + HOP), i / sampleRate)) {
      if (event.type === NoteEventType.On)
        detected.push({ time: event.time * 1000, pitch: event.midi });
    }
  }
  return detected;
}

describe('microphone recordings', () => {
  it.skipIf(recordings.length > 0)('none yet: save one from Settings → Microphone check', () => {});

  describe.each(recordings)('%s', (name) => {
    it('detects the notes played on MIDI', () => {
      const fixture = metas[`${name}.json`]!;
      expect(fixture.audio, `${name}.json has no audio`).toMatch(/^data:audio\/wav;base64,/);

      const midi = fixture.events
        .filter((event) => event.source === Instrument.Midi && event.type === NoteEventType.On)
        .map((event) => ({ time: event.timeMs, pitch: event.pitch }));
      const result = compare(midi, replay(fixture));
      console.log(
        `${name.split('/').at(-1)}: ${result.correct}/${result.reference} correct ` +
          `(${Math.round(result.accuracy * 100)}%), octave ${result.octaveErrors}, ` +
          `wrong ${result.wrongPitch}, missed ${result.missed}, extra ${result.extra}, ` +
          `delay ${result.latencyMs?.toFixed(0)} ms ± ${result.jitterMs?.toFixed(0)}`,
      );
      expect(result.accuracy).toBeGreaterThanOrEqual(fixture.minAccuracy ?? 0);
    });
  });
});
