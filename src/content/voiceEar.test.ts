import { describe, expect, it } from 'vitest';
import { seededRandom } from '../lib/random';
import { pitchClass } from '../theory/pitch';
import { VOICE_UNITS } from './courses';
import { EarLevel, QUESTIONS } from './earTraining';
import { lessonStates } from './unlock';
import { openVoiceEarLevels, VOICE_EAR_UNITS, voiceEarQuestions } from './voiceEar';

/** A baritone's range, A2–F4, comfortable on D3. */
const range = { low: 45, high: 65, comfortable: 50, testedAt: 0 };
const random = seededRandom(7);

describe('openVoiceEarLevels', () => {
  it('opens each level after its unit', () => {
    const upTo = (unitId: string) => {
      const last = VOICE_UNITS.findIndex((unit) => unit.id === unitId);
      const passed = new Set(
        VOICE_UNITS.slice(0, last + 1).flatMap((unit) => unit.lessons.map((lesson) => lesson.id)),
      );
      return openVoiceEarLevels(
        VOICE_UNITS,
        lessonStates(VOICE_UNITS, (id) => (passed.has(id) ? 1 : 0)),
      );
    };
    expect(upTo('v1')).toEqual([]);
    expect(upTo('v2')).toEqual([EarLevel.Notes]);
    expect(upTo('v4')).toEqual([EarLevel.Notes, EarLevel.Melodies]);
    expect(upTo('v5')).toEqual([EarLevel.Notes, EarLevel.Intervals, EarLevel.Melodies]);
    for (const unit of Object.values(VOICE_EAR_UNITS)) {
      expect(VOICE_UNITS.some(({ id }) => id === unit)).toBe(true);
    }
  });
});

describe('voiceEarQuestions', () => {
  it('asks single notes in the range, short of its ends', () => {
    const questions = voiceEarQuestions(EarLevel.Notes, range, new Set(), random);
    expect(questions).toHaveLength(QUESTIONS[EarLevel.Notes]);
    for (const { notes, given, reference } of questions) {
      expect(notes).toHaveLength(1);
      expect(notes[0]).toBeGreaterThanOrEqual(47);
      expect(notes[0]).toBeLessThanOrEqual(63);
      expect(given).toBeNull();
      expect(reference).toBeNull();
    }
  });

  it('asks intervals up and down from near the comfortable note, the first one given', () => {
    const questions = Array.from({ length: 20 }, () =>
      voiceEarQuestions(EarLevel.Intervals, range, new Set(), random),
    ).flat();
    const sizes = new Set(questions.map(({ notes }) => notes[1]! - notes[0]!));
    expect(sizes.has(12) || sizes.has(-12)).toBe(true);
    expect([...sizes].some((size) => size < 0)).toBe(true);
    for (const { notes, given } of questions) {
      expect(given).toBe(notes[0]);
      expect(Math.abs(notes[0]! - range.comfortable)).toBeLessThanOrEqual(7);
      expect([1, 2, 3, 4, 5, 7, 12]).toContain(Math.abs(notes[1]! - notes[0]!));
      for (const note of notes) {
        expect(note).toBeGreaterThanOrEqual(47);
        expect(note).toBeLessThanOrEqual(63);
      }
    }
  });

  it('asks melodies along the major scale, and the minor after Unit 6', () => {
    const major = [0, 2, 4, 5, 7, 9, 11];
    const minor = [0, 2, 3, 5, 7, 8, 10];
    // The scale's key note sits near the comfortable note's octave, in range: E3 to F♯3.
    const keys = [47, 48, 49];
    const inScale = (notes: readonly number[], steps: number[]) =>
      keys.some((key) => notes.every((note) => steps.includes(pitchClass(note - key))));
    const melodies = (finished: Set<string>) =>
      Array.from({ length: 30 }, () =>
        voiceEarQuestions(EarLevel.Melodies, range, finished, random),
      ).flat();
    for (const { notes, given } of melodies(new Set())) {
      expect(given).toBe(notes[0]);
      expect(notes.length).toBeGreaterThanOrEqual(3);
      expect(inScale(notes, major)).toBe(true);
    }
    const withMinor = melodies(new Set(['v6']));
    expect(withMinor.every(({ notes }) => inScale(notes, major) || inScale(notes, minor))).toBe(
      true,
    );
    expect(withMinor.some(({ notes }) => !inScale(notes, major))).toBe(true);
  });
});
