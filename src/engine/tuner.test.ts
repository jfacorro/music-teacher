import { describe, expect, it } from 'vitest';
import { exactPitch, furthestBeyond, isInTune, pitchLean, tunerNote } from './tuner';

describe('pitchLean', () => {
  it('says most notes were sharp (or flat), and by how much on average', () => {
    expect(pitchLean([30, 45, 52, 20, -5, 38, null])).toEqual({ cents: 37, count: 5, total: 6 });
    expect(pitchLean([-20, -30, -25, 5])).toEqual({ cents: -25, count: 3, total: 4 });
  });

  it('says nothing when the notes went both ways, were close, or were too few', () => {
    expect(pitchLean([30, -30, 25, -25])).toBeNull();
    expect(pitchLean([5, 8, -3, 9])).toBeNull();
    expect(pitchLean([40, 40])).toBeNull();
  });

  it('leaves out notes too far off to have been aimed at', () => {
    expect(pitchLean([30, 35, -250, 40])).toEqual({ cents: 35, count: 3, total: 3 });
  });
});

describe('tuner', () => {
  it('turns a reading into an exact pitch', () => {
    expect(exactPitch({ midi: 55, clarity: 0.95, cents: -14 })).toBeCloseTo(54.86);
  });

  it('averages the latest pitches into a note and how far from it', () => {
    expect(tunerNote([55.02, 55.06, 55.04, 55.04])).toEqual({ midi: 55, cents: 4 });
    expect(tunerNote([56.7, 56.6])).toEqual({ midi: 57, cents: -35 });
    expect(tunerNote([])).toBeNull();
  });

  it('calls a note in tune within 25 cents', () => {
    expect(isInTune(25)).toBe(true);
    expect(isInTune(-25)).toBe(true);
    expect(isInTune(26)).toBe(false);
  });
});

describe('furthestBeyond', () => {
  const range = { low: 43, high: 64 }; // G2–E4
  const none = { low: null, high: null };

  it('keeps the lowest note below the range and the highest above it', () => {
    let beyond = furthestBeyond(none, range, 65);
    expect(beyond).toEqual({ low: null, high: 65 });
    beyond = furthestBeyond(beyond, range, 67);
    beyond = furthestBeyond(beyond, range, 66);
    beyond = furthestBeyond(beyond, range, 41);
    expect(beyond).toEqual({ low: 41, high: 67 });
  });

  it('leaves it alone for notes inside the range', () => {
    expect(furthestBeyond({ low: 41, high: null }, range, 55)).toEqual({ low: 41, high: null });
  });
});
