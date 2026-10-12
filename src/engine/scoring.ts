/** Accuracy, stars and per-measure stats (PLAN.md §6.3). */
import type { Measure, ScoreNote } from './score';
import type { Grade } from './timing';

export type NoteOutcome =
  | { kind: 'hit'; grade: Grade; errorMs: number }
  /** Wait mode: played, with no timing. */
  | { kind: 'correct' }
  | { kind: 'missed' };

export const OUTCOME_WEIGHTS = { perfect: 1, good: 0.8, ok: 0.5, correct: 1, missed: 0 };
/** Each wrong or extra key costs a quarter of a note. */
export const WRONG_PENALTY = 0.25;
/** Accuracy needed for 1, 2 and 3 stars. */
export const STAR_THRESHOLDS = [0.6, 0.8, 0.95] as const;

export interface Tally {
  expected: number;
  perfect: number;
  good: number;
  ok: number;
  correct: number;
  missed: number;
  wrong: number;
  accuracy: number;
}

export interface Summary extends Tally {
  stars: 0 | 1 | 2 | 3;
  measures: Tally[];
}

export function weightOf(outcome: NoteOutcome | undefined): number {
  if (!outcome) return 0;
  return outcome.kind === 'hit' ? OUTCOME_WEIGHTS[outcome.grade] : OUTCOME_WEIGHTS[outcome.kind];
}

export function accuracyOf(weights: number, wrong: number, expected: number): number {
  if (expected === 0) return wrong === 0 ? 1 : 0;
  return Math.max(0, Math.min(1, (weights - WRONG_PENALTY * wrong) / expected));
}

export function starsFor(accuracy: number): 0 | 1 | 2 | 3 {
  return STAR_THRESHOLDS.filter((threshold) => accuracy >= threshold - 1e-9).length as
    0 | 1 | 2 | 3;
}

/**
 * @param notes the graded notes
 * @param outcomes what happened to each note (absent = not played, counts as missed)
 * @param wrongBeats beat position of each wrong or extra key press
 */
export function summarize(
  notes: readonly ScoreNote[],
  outcomes: ReadonlyMap<ScoreNote, NoteOutcome>,
  wrongBeats: readonly number[],
  measures: readonly Measure[],
): Summary {
  const total = tally(notes, outcomes, wrongBeats.length);
  const perMeasure = measures.map((measure, index) => {
    const end = measure.start + measure.length;
    const isLast = index === measures.length - 1;
    const inside = (beat: number) => beat >= measure.start && (beat < end || isLast);
    return tally(
      notes.filter((note) => inside(note.start)),
      outcomes,
      wrongBeats.filter((beat) => inside(beat) || (index === 0 && beat < 0)).length,
    );
  });
  return { ...total, stars: starsFor(total.accuracy), measures: perMeasure };
}

function tally(
  notes: readonly ScoreNote[],
  outcomes: ReadonlyMap<ScoreNote, NoteOutcome>,
  wrong: number,
): Tally {
  const result: Tally = {
    expected: notes.length,
    perfect: 0,
    good: 0,
    ok: 0,
    correct: 0,
    missed: 0,
    wrong,
    accuracy: 0,
  };
  let weights = 0;
  for (const note of notes) {
    const outcome = outcomes.get(note);
    weights += weightOf(outcome);
    if (!outcome || outcome.kind === 'missed') result.missed++;
    else if (outcome.kind === 'hit') result[outcome.grade]++;
    else result.correct++;
  }
  result.accuracy = accuracyOf(weights, wrong, notes.length);
  return result;
}
