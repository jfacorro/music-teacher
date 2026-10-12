import { describe, expect, it } from 'vitest';
import { BLACK_KEY_WIDTH, FULL_PIANO, keyAt, keyboardLayout, rangeForNotes } from './layout';

describe('keyboardLayout', () => {
  it('lays out the full piano: 88 keys, 52 white', () => {
    const layout = keyboardLayout(...FULL_PIANO);
    expect(layout.keys).toHaveLength(88);
    expect(layout.whiteCount).toBe(52);
    expect(layout.keys[0]).toEqual({ midi: 21, black: false, x: 0, width: 1 });
    expect(layout.keys.at(-1)).toEqual({ midi: 108, black: false, x: 51, width: 1 });
  });

  it('centers black keys between their white neighbours', () => {
    const layout = keyboardLayout(60, 72);
    expect(layout.byMidi.get(61)).toEqual({
      midi: 61,
      black: true,
      x: 1 - BLACK_KEY_WIDTH / 2,
      width: BLACK_KEY_WIDTH,
    });
    expect(layout.byMidi.get(66)?.x).toBe(4 - BLACK_KEY_WIDTH / 2); // F# between F (3) and G (4)
  });

  it('widens the range so both ends are white keys', () => {
    const layout = keyboardLayout(61, 70);
    expect([layout.low, layout.high]).toEqual([60, 71]);
  });
});

describe('keyAt', () => {
  const layout = keyboardLayout(60, 72); // C4–C5

  it('finds white keys in the lower part', () => {
    expect(keyAt(layout, 0.5, 0.9)?.midi).toBe(60);
    expect(keyAt(layout, 1.0, 0.9)?.midi).toBe(62); // boundary belongs to the right key
  });

  it('prefers black keys in the upper part', () => {
    expect(keyAt(layout, 1.0, 0.3)?.midi).toBe(61);
    expect(keyAt(layout, 0.5, 0.3)?.midi).toBe(60);
  });

  it('returns nothing outside the keyboard', () => {
    expect(keyAt(layout, -0.1, 0.5)).toBeUndefined();
    expect(keyAt(layout, layout.whiteCount, 0.5)).toBeUndefined();
    expect(keyAt(layout, 1, 1.1)).toBeUndefined();
  });
});

describe('rangeForNotes', () => {
  it('spans C to C around the notes, at least two octaves', () => {
    expect(rangeForNotes([60, 67])).toEqual([48, 72]); // C3–C5
    expect(rangeForNotes([60, 72])).toEqual([48, 72]); // a top C needs no extra octave
  });

  it('keeps wide ranges as they are, rounded to Cs', () => {
    expect(rangeForNotes([50, 79])).toEqual([48, 84]);
  });

  it('stays on the piano', () => {
    expect(rangeForNotes([21, 23])).toEqual([21, 48]);
    expect(rangeForNotes([107, 108])).toEqual([84, 108]);
  });

  it('has a default for no notes', () => {
    expect(rangeForNotes([])).toEqual([48, 72]);
  });
});
