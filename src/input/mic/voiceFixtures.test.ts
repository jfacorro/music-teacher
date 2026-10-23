/**
 * Replays recordings of a voice singing Match the note (fixtures/voice/*.json, saved from the
 * Tuner page) through the note detector and the matcher, and compares with how each note went
 * while singing. Prints a report per recording; fails if fewer notes are matched in time than
 * the recording's `minMatched` (set once a baseline is known).
 */
import { describe, expect, it } from 'vitest';
import { type NoteMatch, NoteMatcher } from '../../engine/matchNote';
import { exactPitch } from '../../engine/tuner';
import { NoteDetector, READING_EVERY_HOPS } from './detector';
import type { VoiceRecordingFile } from './voiceRecording';
import { bytesFromDataUrl, dataUrlFromBytes, decodeWav, encodeWav } from './wav';

type Fixture = VoiceRecordingFile & { minMatched?: number };

const metas = import.meta.glob<Fixture>('/fixtures/voice/*.json', {
  eager: true,
  import: 'default',
});
const recordings = Object.keys(metas).map((path) => path.replace(/\.json$/, ''));

const HOP = 512;

/** Each note asked, judged again from the recorded audio, as the Tuner page judges it. */
function replay(fixture: VoiceRecordingFile): NoteMatch[] {
  const { samples, sampleRate } = decodeWav(bytesFromDataUrl(fixture.audio));
  const detector = new NoteDetector({ sampleRate, gateDb: fixture.gateDb, hopSize: HOP });
  const matchers = fixture.notes.map((note) => {
    const matcher = new NoteMatcher(note.target);
    matcher.listen(note.fromMs);
    return matcher;
  });
  for (let i = 0, hop = 1; i + HOP <= samples.length; i += HOP, hop++) {
    detector.process(samples.subarray(i, i + HOP), i / sampleRate);
    if (hop % READING_EVERY_HOPS !== 0) continue;
    const time = (i / sampleRate) * 1000;
    const index = fixture.notes.findIndex((note) => time >= note.fromMs && time < note.toMs);
    const reading = detector.reading;
    matchers[index]?.update(reading ? exactPitch(reading) : null, time);
  }
  return matchers.map((matcher) => matcher.result());
}

describe('voice recordings', () => {
  it('replays a recording: a steady tone matches its note, in any octave', () => {
    const sampleRate = 48_000;
    const tone = (midi: number, seconds: number) =>
      Array.from(
        { length: seconds * sampleRate },
        (_, i) => 0.3 * Math.sin((2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i) / sampleRate),
      );
    // A3 an octave down for a second, then silence, then a whole step off for a second.
    const audio = new Float32Array([
      ...tone(45, 1),
      ...Array<number>(sampleRate / 2).fill(0),
      ...tone(60, 1),
    ]);
    const fixture: VoiceRecordingFile = {
      version: 1,
      sampleRate,
      gateDb: -50,
      notes: [
        { target: 57, fromMs: 0, toMs: 1400, matched: true, inTime: true },
        { target: 62, fromMs: 1500, toMs: 2500, matched: false, inTime: false },
      ],
      recordedAt: '',
      audio: dataUrlFromBytes(encodeWav(audio, sampleRate), 'audio/wav'),
    };
    const [a, d] = replay(fixture);
    expect(a).toMatchObject({ target: 57, inTime: true });
    expect(Math.abs(a!.offset!)).toBeLessThan(5);
    expect(d).toMatchObject({ target: 62, inTime: false });
    expect(d!.offset).toBeCloseTo(-200, -1);
  });

  it.skipIf(recordings.length > 0)('none yet: save one from the Tuner page’s results', () => {});

  describe.each(recordings)('%s', (name) => {
    it('matches the notes sung', () => {
      const fixture = metas[`${name}.json`]!;
      expect(fixture.audio, `${name}.json has no audio`).toMatch(/^data:audio\/wav;base64,/);
      const results = replay(fixture);
      const inTime = results.filter((result) => result.inTime).length;
      const live = fixture.notes.filter((note) => note.inTime).length;
      console.log(
        `${name.split('/').at(-1)}: ${inTime}/${results.length} in time (${live} while singing): ` +
          results
            .map((result) => `${result.target}${result.inTime ? '✓' : '✗'}${result.offset ?? ''}`)
            .join(' '),
      );
      expect(inTime).toBeGreaterThanOrEqual(fixture.minMatched ?? 0);
    });
  });
});
