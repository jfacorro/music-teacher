import { describe, expect, it } from 'vitest';
import { seededRandom } from '../lib/random';
import {
  centsFrom,
  MATCH_NOTES,
  MATCH_WITHIN_MS,
  matchSummary,
  matchTargets,
  type NoteMatch,
  NoteMatcher,
} from './matchNote';

/** Feeds readings every 40 ms (about the microphone's rate) and returns the last result. */
function sing(matcher: NoteMatcher, pitches: (number | null)[], start = 0) {
  return pitches.map((pitch, i) => matcher.update(pitch, start + i * 40)).at(-1)!;
}

describe('matchTargets', () => {
  it('deals notes from the range, short of its ends, each as evenly as possible', () => {
    const targets = matchTargets({ low: 48, high: 67 }, MATCH_NOTES, seededRandom(1));
    expect(targets).toHaveLength(MATCH_NOTES);
    expect(Math.min(...targets)).toBeGreaterThanOrEqual(50);
    expect(Math.max(...targets)).toBeLessThanOrEqual(65);
    expect(new Set(targets).size).toBe(MATCH_NOTES);
  });

  it('keeps the ends of a narrow range', () => {
    const targets = matchTargets({ low: 55, high: 62 }, MATCH_NOTES, seededRandom(2));
    expect(new Set(targets)).toEqual(new Set([55, 56, 57, 58, 59, 60, 61, 62]));
    targets.slice(1).forEach((note, i) => expect(note).not.toBe(targets[i]));
  });
});

describe('centsFrom', () => {
  it('measures from the nearest octave of the note', () => {
    expect(centsFrom(60, 60.2)).toBe(20);
    expect(centsFrom(60, 47.7)).toBe(-30);
    expect(centsFrom(60, 72)).toBe(0);
    expect(centsFrom(60, 65)).toBe(500);
    expect(centsFrom(60, 66.5)).toBe(-550);
  });
});

describe('NoteMatcher', () => {
  it('matches a note held in tune for half a second, in any octave', () => {
    const matcher = new NoteMatcher(57);
    matcher.listen(0);
    expect(sing(matcher, Array<number>(7).fill(45.2))).toBeCloseTo(0.48);
    expect(matcher.matched).toBe(false);
    expect(sing(matcher, Array<number>(7).fill(44.9), 280)).toBe(1);
    expect(matcher.result()).toEqual({ target: 57, inTime: true, offset: 5 });
  });

  it('starts the hold over when the singing goes out of tune', () => {
    const matcher = new NoteMatcher(60);
    matcher.listen(0);
    sing(matcher, [59.5, 59.6, 59.8, 60, 60, 60]);
    expect(sing(matcher, [59.3, 60, 60, 60], 240)).toBeCloseTo(80 / 500);
  });

  it('counts only a match within the time limit, starting over when heard again', () => {
    const late = new NoteMatcher(60);
    late.listen(0);
    sing(late, [57, 57.2, 57.1], 1000);
    sing(late, Array<number>(14).fill(60.3), MATCH_WITHIN_MS);
    expect(late.result()).toEqual({ target: 60, inTime: false, offset: 30 });

    const again = new NoteMatcher(60);
    again.listen(0);
    again.listen(MATCH_WITHIN_MS);
    sing(again, Array<number>(14).fill(60), MATCH_WITHIN_MS + 1000);
    expect(again.result().inTime).toBe(true);
  });

  it('says how far off everything sung was when it was never matched', () => {
    const matcher = new NoteMatcher(60);
    matcher.listen(0);
    sing(matcher, [58, 58, 58.2, null, null]);
    expect(matcher.result()).toEqual({ target: 60, inTime: false, offset: -193 });
    expect(new NoteMatcher(62).result()).toEqual({ target: 62, inTime: false, offset: null });
  });
});

describe('matchSummary', () => {
  const note = (target: number, inTime: boolean, offset: number | null): NoteMatch => ({
    target,
    inTime,
    offset,
  });

  it('scores the notes matched in time, and lists the ones to work on', () => {
    const summary = matchSummary([
      note(60, true, 5),
      note(62, true, -30),
      note(64, false, -120),
      note(60, true, 10),
      note(57, true, 40),
      note(64, true, -20),
      note(59, false, null),
      note(65, true, 0),
      note(67, true, 20),
      note(69, true, -10),
    ]);
    expect(summary).toMatchObject({ matched: 8, total: 10, accuracy: 0.8, stars: 2 });
    expect(summary.toWorkOn).toEqual([
      note(57, true, 40),
      note(59, false, null),
      note(62, true, -30),
      note(64, false, -70),
    ]);
  });
});
