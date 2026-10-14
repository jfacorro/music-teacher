import { describe, expect, it } from 'vitest';
import type { Tally } from './scoring';
import { weakSpot } from './weakSpots';

/** Measures with these accuracies (null: a measure with no notes). */
const measures = (...accuracies: (number | null)[]): Tally[] =>
  accuracies.map((accuracy) => ({
    expected: accuracy === null ? 0 : 4,
    perfect: 0,
    good: 0,
    ok: 0,
    correct: 0,
    missed: 0,
    wrong: 0,
    accuracy: accuracy ?? 1,
  }));

describe('weakSpot', () => {
  it('finds nothing when every measure went well', () => {
    expect(weakSpot(measures(1, 0.95, 0.9))).toBeNull();
    expect(weakSpot([])).toBeNull();
  });

  it('picks the worst measure', () => {
    expect(weakSpot(measures(1, 0.5, 1, 0.7, 1))).toEqual({ first: 1, last: 1 });
  });

  it('joins weak neighbors, the weaker side first, up to four measures', () => {
    expect(weakSpot(measures(1, 0.8, 0.4, 0.6, 1))).toEqual({ first: 1, last: 3 });
    expect(weakSpot(measures(0.5, 0.5, 0.2, 0.5, 0.5, 0.5))).toEqual({ first: 0, last: 3 });
  });

  it('skips measures without notes', () => {
    expect(weakSpot(measures(null, 0.5, null))).toEqual({ first: 1, last: 1 });
  });
});
