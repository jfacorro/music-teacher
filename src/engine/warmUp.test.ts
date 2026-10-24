import { describe, expect, it } from 'vitest';
import { WARM_UP_PATTERN, warmUpDuration, warmUpNotes, warmUpRoots } from './warmUp';

describe('warmUpRoots', () => {
  it('starts a whole step below the comfortable note, goes up three half steps and back', () => {
    expect(warmUpRoots({ low: 48, high: 67, comfortable: 57 })).toEqual([
      55, 56, 57, 58, 57, 56, 55,
    ]);
  });

  it('starts lower and goes up less when the top of the range is close', () => {
    expect(warmUpRoots({ low: 48, high: 62, comfortable: 61 })).toEqual([58]);
    expect(warmUpRoots({ low: 48, high: 64, comfortable: 61 })).toEqual([59, 60, 59]);
  });

  it('never starts under the bottom of the range', () => {
    expect(warmUpRoots({ low: 55, high: 67, comfortable: 55 })).toEqual([
      55, 56, 57, 58, 57, 56, 55,
    ]);
    expect(warmUpRoots({ low: 60, high: 62, comfortable: 61 })).toEqual([60]);
  });
});

describe('warmUpNotes', () => {
  it('plays the pattern from each root, then leaves as long to sing it back', () => {
    const notes = warmUpNotes([60, 61], 500);
    expect(notes.map((note) => note.midi)).toEqual([60, 62, 64, 62, 60, 61, 63, 65, 63, 61]);
    expect(notes.slice(0, 2)).toEqual([
      { midi: 60, start: 0, end: 500 },
      { midi: 62, start: 500, end: 1000 },
    ]);
    // The second time starts after the first and its silence.
    expect(notes[WARM_UP_PATTERN.length]).toEqual({ midi: 61, start: 5000, end: 5500 });
    expect(warmUpDuration([60, 61], 500)).toBe(10000);
  });
});
