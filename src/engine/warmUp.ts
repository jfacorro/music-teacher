/**
 * The vocal warm-up that starts each voice lesson (PLAN.md milestone 6.2): a five-note pattern
 * (do re mi re do) played from near the comfortable note, a half step higher each time, then back
 * down. Each time the app plays it, then leaves the same time silent to sing it back, so it works
 * without headphones.
 */

/** The pattern, in semitones above its first note: do re mi re do. */
export const WARM_UP_PATTERN = [0, 2, 4, 2, 0] as const;
/** How many half steps it goes up before coming back down. */
const STEPS_UP = 3;
/** How long each note is played, ms. */
export const WARM_UP_NOTE_MS = 500;

/** The highest note the pattern reaches above its first. */
const SPAN = Math.max(...WARM_UP_PATTERN);

/**
 * The first note of each time through the pattern: from a whole step below the comfortable note
 * (lower when the pattern wouldn't fit under the top of the range, never under its bottom), up a
 * half step at a time while the pattern still fits, then back down to where it started.
 */
export function warmUpRoots(range: { low: number; high: number; comfortable: number }): number[] {
  const start = Math.max(range.low, Math.min(range.comfortable - 2, range.high - SPAN));
  const up = [start];
  while (up.length <= STEPS_UP && up.at(-1)! + 1 + SPAN <= range.high) up.push(up.at(-1)! + 1);
  return [...up, ...up.slice(0, -1).reverse()];
}

/** A note to play, in ms from the start. */
export interface WarmUpNote {
  midi: number;
  start: number;
  end: number;
}

/** The notes to play: the pattern from each root, each followed by the same time to sing it. */
export function warmUpNotes(roots: readonly number[], noteMs = WARM_UP_NOTE_MS): WarmUpNote[] {
  const turn = 2 * WARM_UP_PATTERN.length * noteMs;
  return roots.flatMap((root, i) =>
    WARM_UP_PATTERN.map((step, j) => ({
      midi: root + step,
      start: i * turn + j * noteMs,
      end: i * turn + (j + 1) * noteMs,
    })),
  );
}

/** How long it all takes, singing back the last time included, ms. */
export function warmUpDuration(roots: readonly number[], noteMs = WARM_UP_NOTE_MS): number {
  return roots.length * 2 * WARM_UP_PATTERN.length * noteMs;
}
