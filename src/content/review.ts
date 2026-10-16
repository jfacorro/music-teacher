/**
 * Spaced reviews (PLAN.md milestone 4.1): a finished lesson comes back after a few days —
 * sooner when it went less well — and waits longer each time a review goes well.
 */

/** Days until the first review, by stars earned. */
export const FIRST_REVIEW_DAYS: Readonly<Record<1 | 2 | 3, number>> = { 1: 3, 2: 7, 3: 14 };
/** Reviews never wait longer than this. */
export const MAX_REVIEW_DAYS = 90;
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewState {
  /** The current wait between reviews. */
  reviewDays: number;
  /** When it's due (ms since epoch). */
  reviewDue: number;
}

const firstWait = (stars: number) =>
  FIRST_REVIEW_DAYS[Math.min(3, Math.max(1, stars)) as 1 | 2 | 3];

/**
 * The schedule after an attempt with `stars`:
 * - not passed (0 stars): unchanged, so a lesson that's due stays due;
 * - the first pass: the first wait for its stars;
 * - a review played when due: twice the wait if it went well (2 stars or more), otherwise back
 *   to the first wait;
 * - played before it was due: the same wait, counted from now.
 */
export function nextReview(
  previous: ReviewState | null,
  stars: number,
  now: number,
): ReviewState | null {
  if (stars < 1) return previous;
  if (!previous)
    return { reviewDays: firstWait(stars), reviewDue: now + firstWait(stars) * DAY_MS };
  const reviewDays =
    now < previous.reviewDue
      ? previous.reviewDays
      : stars >= 2
        ? Math.min(previous.reviewDays * 2, MAX_REVIEW_DAYS)
        : firstWait(stars);
  return { reviewDays, reviewDue: now + reviewDays * DAY_MS };
}

/** A result's schedule; results saved before reviews existed get one from their best stars. */
export function reviewOf(row: {
  bestStars: number;
  lastPlayedAt: number;
  reviewDays?: number;
  reviewDue?: number;
}): ReviewState | null {
  if (row.reviewDays !== undefined && row.reviewDue !== undefined) {
    return { reviewDays: row.reviewDays, reviewDue: row.reviewDue };
  }
  if (row.bestStars < 1) return null;
  const days = firstWait(row.bestStars);
  return { reviewDays: days, reviewDue: row.lastPlayedAt + days * DAY_MS };
}
