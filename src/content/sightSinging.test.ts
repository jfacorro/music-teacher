import { describe, expect, it } from 'vitest';
import { beatsPerMeasure } from '../engine/score';
import { keyAlterOf, keyStepOf } from '../theory/keys';
import { VOICE_UNITS } from './courses';
import {
  freshSingDrillSeed,
  makeSingDrill,
  openSingDrillLevels,
  SING_DRILL_LEVELS,
  SingDrillLevel,
} from './sightSinging';
import { lessonStates } from './unlock';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

describe('sight-singing drills', () => {
  it('open once Voice Unit 7 is finished', () => {
    const none = lessonStates(VOICE_UNITS, () => 0);
    expect(openSingDrillLevels(VOICE_UNITS, none)).toEqual([]);
    const all = lessonStates(VOICE_UNITS, () => 3);
    expect(openSingDrillLevels(VOICE_UNITS, all)).toEqual(SING_DRILL_LEVELS);
  });

  it.each(SING_DRILL_LEVELS)('%s: four bars in a major key, ending on the key note', (level) => {
    for (const seed of SEEDS) {
      const { score } = makeSingDrill(level, seed);
      const keyFifths = score.keyFifths ?? 0;
      expect(score.measures).toHaveLength(4);
      const end = score.notes.at(-1)!;
      expect(end.start + end.duration).toBe(4 * beatsPerMeasure(score.timeSignature));
      expect(end.pitch.step).toBe(keyStepOf(keyFifths));
      for (const note of score.notes) {
        expect(note.pitch.alter).toBe(keyAlterOf(note.pitch.step, keyFifths));
      }
      // One note at a time.
      score.notes.slice(1).forEach((note, i) => {
        const before = score.notes[i]!;
        expect(note.start).toBeGreaterThanOrEqual(before.start + before.duration);
      });
    }
  });

  const largestMove = (level: SingDrillLevel) =>
    Math.max(
      ...SEEDS.flatMap((seed) => {
        const { notes } = makeSingDrill(level, seed).score;
        return notes.slice(1).map((note, i) => Math.abs(note.pitch.midi - notes[i]!.pitch.midi));
      }),
    );

  it('moves by steps, then leaps up to a fifth, never a tritone', () => {
    expect(largestMove(SingDrillLevel.Steps)).toBeLessThanOrEqual(2);
    expect(largestMove(SingDrillLevel.Leaps)).toBe(7);
    for (const seed of SEEDS) {
      const { notes } = makeSingDrill(SingDrillLevel.Leaps, seed).score;
      notes.slice(1).forEach((note, i) => {
        expect(Math.abs(note.pitch.midi - notes[i]!.pitch.midi)).not.toBe(6);
      });
    }
  });

  it('has rests and eighth notes from the third level', () => {
    const plain = makeSingDrill(SingDrillLevel.Leaps, 5).score.notes;
    expect(plain.every((note) => note.duration >= 1)).toBe(true);
    const mixed = makeSingDrill(SingDrillLevel.Rhythms, 5).score.notes;
    expect(mixed.some((note) => note.duration === 0.5)).toBe(true);
  });

  it('is the same drill for the same seed, and a fresh one otherwise', () => {
    expect(makeSingDrill(SingDrillLevel.Leaps, 42)).toEqual(
      makeSingDrill(SingDrillLevel.Leaps, 42),
    );
    const seed = freshSingDrillSeed(SingDrillLevel.Steps, [42]);
    expect(seed).not.toBe(42);
  });
});
