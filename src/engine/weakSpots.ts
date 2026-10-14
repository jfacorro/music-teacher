/** "Practice weak spots" (PLAN.md §2.3): the measures of a run that went worst, to loop them. */
import type { Tally } from './scoring';
import type { LoopRange } from './session';

/** Measures below this accuracy need practice. */
export const WEAK_BELOW = 0.9;
/** At most this many measures in a row: a short phrase to repeat. */
export const MAX_WEAK_MEASURES = 4;

/**
 * The worst measure, joined by weak neighbors (the weaker side first) up to
 * `MAX_WEAK_MEASURES`; null when every measure went well.
 */
export function weakSpot(measures: readonly Tally[]): LoopRange | null {
  const played = (m: Tally | undefined): m is Tally => !!m && (m.expected > 0 || m.wrong > 0);
  const weakness = (index: number) => {
    const m = measures[index];
    return played(m) && m.accuracy < WEAK_BELOW ? m.accuracy : Infinity;
  };

  let worst = -1;
  measures.forEach((m, index) => {
    if (played(m) && (worst < 0 || m.accuracy < measures[worst]!.accuracy)) worst = index;
  });
  if (weakness(worst) === Infinity) return null;

  let first = worst;
  let last = worst;
  while (last - first + 1 < MAX_WEAK_MEASURES) {
    const before = weakness(first - 1);
    const after = weakness(last + 1);
    if (before === Infinity && after === Infinity) break;
    if (before <= after) first--;
    else last++;
  }
  return { first, last };
}
