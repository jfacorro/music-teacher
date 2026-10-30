/**
 * Note-naming quiz (PLAN.md §2.5): flash cards with one note on the staff; the learner plays
 * its key. A card counts when the right key is the first one played.
 */
import type { Pitch } from '../theory/pitch';
import { accuracyOf, starsFor } from './scoring';

/**
 * `count` items drawn from `items`, never the same one twice in a row (when there's a choice)
 * and each as evenly as possible.
 */
export function deal<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random,
  same: (a: T, b: T) => boolean = Object.is,
): T[] {
  const dealt: T[] = [];
  let bag: T[] = [];
  while (dealt.length < count && items.length > 0) {
    if (bag.length === 0) bag = [...items];
    const previous = dealt.at(-1);
    const choices = bag.filter(
      (item) => bag.length === 1 || previous === undefined || !same(item, previous),
    );
    const pick = choices[Math.floor(random() * choices.length)] ?? bag[0]!;
    bag.splice(bag.indexOf(pick), 1);
    dealt.push(pick);
  }
  return dealt;
}

/** `count` note cards drawn from `notes` (see `deal`). */
export function quizCards(
  notes: readonly Pitch[],
  count: number,
  random: () => number = Math.random,
): Pitch[] {
  return deal(notes, count, random, (a, b) => a.midi === b.midi);
}

export interface QuizResult {
  /** Cards answered with the right key on the first try. */
  firstTry: number;
  total: number;
  accuracy: number;
  stars: 0 | 1 | 2 | 3;
}

export function quizResult(firstTry: number, total: number): QuizResult {
  const accuracy = accuracyOf(firstTry, 0, total);
  return { firstTry, total, accuracy, stars: starsFor(accuracy) };
}
