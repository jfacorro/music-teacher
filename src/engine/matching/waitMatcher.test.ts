import { describe, expect, it } from 'vitest';
import { scoreOf } from '../testUtils';
import { WaitMatcher, groupByStart } from './waitMatcher';
import { Hand } from '../score';

const C3 = 48;
const C4 = 60;
const D4 = 62;
const E4 = 64;
const TOLERANCE = 150;

describe('groupByStart', () => {
  it('groups notes that start together', () => {
    const { notes } = scoreOf([
      ['C3', 0, 4, Hand.Left],
      ['E4', 0],
      ['D4', 1],
    ]);
    expect(groupByStart(notes).map((g) => [g.start, g.notes.map((n) => n.pitch.midi)])).toEqual([
      [0, [C3, E4]],
      [1, [D4]],
    ]);
  });
});

describe('WaitMatcher', () => {
  it('advances one note at a time on the right keys', () => {
    const matcher = new WaitMatcher(
      scoreOf([
        ['C4', 0],
        ['D4', 1],
      ]).notes,
    );
    expect(matcher.current?.start).toBe(0);
    expect(matcher.press(C4, 1000, TOLERANCE)).toMatchObject({
      kind: 'correct',
      groupComplete: true,
    });
    expect(matcher.current?.start).toBe(1);
    expect(matcher.press(D4, 5000, TOLERANCE)).toMatchObject({
      kind: 'correct',
      groupComplete: true,
    });
    expect(matcher.done).toBe(true);
  });

  it('flags wrong keys without advancing', () => {
    const matcher = new WaitMatcher(scoreOf([['C4', 0]]).notes);
    expect(matcher.press(D4, 0, TOLERANCE)).toEqual({ kind: 'wrong', pitch: D4 });
    expect(matcher.current?.start).toBe(0);
  });

  it('accepts a chord pressed within the tolerance', () => {
    const matcher = new WaitMatcher(
      scoreOf([
        ['C4', 0],
        ['E4', 0],
      ]).notes,
    );
    expect(matcher.press(C4, 1000, TOLERANCE)).toMatchObject({ groupComplete: false });
    matcher.release(C4);
    expect(matcher.press(E4, 1100, TOLERANCE)).toMatchObject({ groupComplete: true });
  });

  it('accepts a chord built up slowly while the keys stay down', () => {
    const matcher = new WaitMatcher(
      scoreOf([
        ['C3', 0, 1, Hand.Left],
        ['E4', 0],
      ]).notes,
    );
    matcher.press(C3, 1000, TOLERANCE);
    expect(matcher.press(E4, 3000, TOLERANCE)).toMatchObject({ groupComplete: true });
  });

  it('rejects a chord whose keys were neither together nor held', () => {
    const matcher = new WaitMatcher(
      scoreOf([
        ['C4', 0],
        ['E4', 0],
      ]).notes,
    );
    matcher.press(C4, 1000, TOLERANCE);
    matcher.release(C4);
    expect(matcher.press(E4, 2000, TOLERANCE)).toMatchObject({ groupComplete: false });
    // Pressing C4 again while E4 is still down completes it.
    expect(matcher.press(C4, 2500, TOLERANCE)).toMatchObject({ groupComplete: true });
  });

  it('says which notes of the chord still have to be played', () => {
    const matcher = new WaitMatcher(
      scoreOf([
        ['C3', 0, 1, Hand.Left],
        ['E4', 0],
      ]).notes,
    );
    const missing = () => matcher.missing.map((n) => n.pitch.midi);
    expect(missing()).toEqual([C3, E4]);
    matcher.press(E4, 1000, TOLERANCE);
    expect(missing()).toEqual([C3]); // E4 is held
    matcher.release(E4);
    expect(missing()).toEqual([C3, E4]); // played together or held: E4 is needed again
  });

  it('can let any key of a chord complete it (for the microphone)', () => {
    const matcher = new WaitMatcher(
      scoreOf([
        ['C3', 0, 1, Hand.Left],
        ['E4', 0],
      ]).notes,
    );
    expect(matcher.press(E4, 1000, TOLERANCE, true)).toMatchObject({ groupComplete: true });
    expect(matcher.done).toBe(true);
  });

  it('needs a fresh press for a repeated note, even if the key is still down', () => {
    const matcher = new WaitMatcher(
      scoreOf([
        ['C4', 0],
        ['C4', 1],
        ['E4', 1],
      ]).notes,
    );
    matcher.press(C4, 1000, TOLERANCE); // completes the first group; C4 stays down
    expect(matcher.press(E4, 2000, TOLERANCE)).toMatchObject({ groupComplete: false });
    matcher.release(C4);
    expect(matcher.press(C4, 2100, TOLERANCE)).toMatchObject({ groupComplete: true });
  });

  it('treats any key after the last group as wrong', () => {
    const matcher = new WaitMatcher(scoreOf([['C4', 0]]).notes);
    matcher.press(C4, 0, TOLERANCE);
    expect(matcher.press(C4, 500, TOLERANCE)).toEqual({ kind: 'wrong', pitch: C4 });
  });
});
