import { describe, expect, it } from 'vitest';
import { accuracyOf, starsFor, summarize, type NoteOutcome } from './scoring';
import type { ScoreNote } from './score';
import { scoreOf } from './testUtils';

describe('accuracyOf', () => {
  it('weights hits and subtracts a quarter note per wrong key', () => {
    expect(accuracyOf(4, 0, 4)).toBe(1);
    expect(accuracyOf(4, 2, 4)).toBe(0.875);
    expect(accuracyOf(1, 10, 4)).toBe(0); // never negative
    expect(accuracyOf(0, 0, 0)).toBe(1);
  });
});

describe('starsFor', () => {
  it.each([
    [0.59, 0],
    [0.6, 1],
    [0.79, 1],
    [0.8, 2],
    [0.949, 2],
    [0.95, 3],
    [1, 3],
  ])('%f → %i stars', (accuracy, stars) => {
    expect(starsFor(accuracy)).toBe(stars);
  });
});

describe('summarize', () => {
  const score = scoreOf([
    ['C4', 0],
    ['D4', 1],
    ['E4', 2],
    ['F4', 3],
    ['G4', 4],
    ['A4', 5],
  ]);
  const [c, d, e, f, g, a] = score.notes as [ScoreNote, ...ScoreNote[]];

  it('counts outcomes, accuracy and stars', () => {
    const outcomes = new Map<ScoreNote, NoteOutcome>([
      [c, { kind: 'hit', grade: 'perfect', errorMs: 0 }],
      [d!, { kind: 'hit', grade: 'perfect', errorMs: 10 }],
      [e!, { kind: 'hit', grade: 'good', errorMs: -70 }],
      [f!, { kind: 'hit', grade: 'ok', errorMs: 120 }],
      [g!, { kind: 'missed' }],
      // a: never played → missed
    ]);
    const summary = summarize(score.notes, outcomes, [2.5], score.measures);
    expect(summary).toMatchObject({
      expected: 6,
      perfect: 2,
      good: 1,
      ok: 1,
      missed: 2,
      wrong: 1,
    });
    // (1 + 1 + 0.8 + 0.5 - 0.25) / 6
    expect(summary.accuracy).toBeCloseTo(3.05 / 6);
    expect(summary.stars).toBe(0);
    expect(a).toBeDefined();
  });

  it('scores wait mode: every note correct, minus wrong keys', () => {
    const outcomes = new Map<ScoreNote, NoteOutcome>(
      score.notes.map((note) => [note, { kind: 'correct' }]),
    );
    const summary = summarize(score.notes, outcomes, [0.5, 4.2], score.measures);
    expect(summary.correct).toBe(6);
    expect(summary.accuracy).toBeCloseTo(5.5 / 6);
    expect(summary.stars).toBe(2);
  });

  it('breaks results down per measure', () => {
    const outcomes = new Map<ScoreNote, NoteOutcome>(
      score.notes.map((note) => [note, { kind: 'correct' }]),
    );
    // A wrong key before the music starts belongs to the first measure.
    const summary = summarize(score.notes, outcomes, [-0.5, 5.5], score.measures);
    expect(summary.measures).toHaveLength(2);
    expect(summary.measures[0]).toMatchObject({ expected: 4, wrong: 1, accuracy: 3.75 / 4 });
    expect(summary.measures[1]).toMatchObject({ expected: 2, wrong: 1, accuracy: 1.75 / 2 });
  });
});
