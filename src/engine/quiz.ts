/**
 * Note-naming quiz (PLAN.md §2.5): flash cards with one note on the staff; the learner plays
 * its key. A card counts when the right key is the first one played.
 */
import type { Pitch } from '../theory/pitch';
import { accuracyOf, starsFor } from './scoring';

/**
 * `count` cards drawn from `notes`, never the same note twice in a row (when there's a choice)
 * and each note as evenly as possible.
 */
export function quizCards(
  notes: readonly Pitch[],
  count: number,
  random: () => number = Math.random,
): Pitch[] {
  const cards: Pitch[] = [];
  let bag: Pitch[] = [];
  while (cards.length < count && notes.length > 0) {
    if (bag.length === 0) bag = [...notes];
    const previous = cards.at(-1);
    const choices = bag.filter((note) => bag.length === 1 || note.midi !== previous?.midi);
    const pick = choices[Math.floor(random() * choices.length)] ?? bag[0]!;
    bag.splice(bag.indexOf(pick), 1);
    cards.push(pick);
  }
  return cards;
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
