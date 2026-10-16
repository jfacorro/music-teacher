import { describe, expect, it } from 'vitest';
import { DAY_MS, MAX_REVIEW_DAYS, nextReview, reviewOf } from './review';

const day = (n: number) => n * DAY_MS;

describe('nextReview', () => {
  it('waits longer after a better first pass', () => {
    expect(nextReview(null, 1, 0)).toEqual({ reviewDays: 3, reviewDue: day(3) });
    expect(nextReview(null, 2, 0)).toEqual({ reviewDays: 7, reviewDue: day(7) });
    expect(nextReview(null, 3, 0)).toEqual({ reviewDays: 14, reviewDue: day(14) });
  });

  it('doubles the wait after a good review, up to a limit', () => {
    const due = { reviewDays: 7, reviewDue: day(7) };
    expect(nextReview(due, 2, day(8))).toEqual({ reviewDays: 14, reviewDue: day(22) });
    expect(nextReview({ reviewDays: 80, reviewDue: day(7) }, 3, day(8))?.reviewDays).toBe(
      MAX_REVIEW_DAYS,
    );
  });

  it('starts over after a poor review, and doesn’t move for a failed attempt', () => {
    const due = { reviewDays: 14, reviewDue: day(14) };
    expect(nextReview(due, 1, day(15))).toEqual({ reviewDays: 3, reviewDue: day(18) });
    expect(nextReview(due, 0, day(15))).toBe(due);
  });

  it('counts the same wait from now when played early', () => {
    const due = { reviewDays: 7, reviewDue: day(7) };
    expect(nextReview(due, 3, day(2))).toEqual({ reviewDays: 7, reviewDue: day(9) });
  });
});

describe('reviewOf', () => {
  it('schedules results saved before reviews from their best stars', () => {
    expect(reviewOf({ bestStars: 2, lastPlayedAt: day(1) })).toEqual({
      reviewDays: 7,
      reviewDue: day(8),
    });
    expect(reviewOf({ bestStars: 0, lastPlayedAt: day(1) })).toBeNull();
    expect(reviewOf({ bestStars: 3, lastPlayedAt: 0, reviewDays: 28, reviewDue: day(30) })).toEqual(
      { reviewDays: 28, reviewDue: day(30) },
    );
  });
});
