/** Accuracy, stars, timing and per-measure stats (PLAN.md §6.3). */
import type { DynamicsSummary } from './dynamics';
import type { TouchSummary } from './touch';
import { Hand, type Measure, type ScoreNote } from './score';
import { timingOf, type Grade, type TimingWindows, Timing } from './timing';

export const OutcomeKind = {
  Hit: 'hit',
  Correct: 'correct',
  Missed: 'missed',
} as const;
export type OutcomeKind = (typeof OutcomeKind)[keyof typeof OutcomeKind];

export type NoteOutcome =
  | { kind: typeof OutcomeKind.Hit; grade: Grade; errorMs: number }
  /** Wait mode: played, with no timing. */
  | { kind: typeof OutcomeKind.Correct }
  | { kind: typeof OutcomeKind.Missed };

export const OUTCOME_WEIGHTS = { perfect: 1, good: 0.8, ok: 0.5, correct: 1, missed: 0 };
/** Each wrong or extra key costs a quarter of a note. */
export const WRONG_PENALTY = 0.25;
/** Accuracy needed for 1, 2 and 3 stars. */
export const STAR_THRESHOLDS = [0.6, 0.8, 0.95] as const;
/** The most stars a lesson or song can earn. */
export const MAX_STARS = STAR_THRESHOLDS.length;

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

/** How early or late the notes were played (tempo mode). */
export interface TimingSummary {
  /** Timing error of each note played, in score order, ms (negative = early). */
  errorsMs: number[];
  early: number;
  onTime: number;
  late: number;
  /** Average error, ms: below zero, early on average. */
  meanMs: number;
  /** The windows the notes were graded with. */
  windows: TimingWindows;
}

export interface Summary extends Tally {
  stars: 0 | 1 | 2 | 3;
  measures: Tally[];
  /** Null in wait mode, where timing isn't graded. */
  timing: TimingSummary | null;
  /** Null without dynamics in the score, or without a MIDI keyboard to measure them. */
  dynamics: DynamicsSummary | null;
  /** Null without staccato, accents, tenuto or slurs, or without a MIDI keyboard. */
  touch: TouchSummary | null;
  /**
   * Each hand on its own, when both were played, with the wrong keys put down to each hand;
   * null for one hand.
   */
  hands: { hand: Hand; tally: Tally }[] | null;
}

export function weightOf(outcome: NoteOutcome | undefined): number {
  if (!outcome) return 0;
  return outcome.kind === OutcomeKind.Hit
    ? OUTCOME_WEIGHTS[outcome.grade]
    : OUTCOME_WEIGHTS[outcome.kind];
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
 * @param windows the timing windows, to break timing down (tempo mode)
 * @param wrongHands the hand each wrong key is put down to, in the order of `wrongBeats`
 */
export function summarize(
  notes: readonly ScoreNote[],
  outcomes: ReadonlyMap<ScoreNote, NoteOutcome>,
  wrongBeats: readonly number[],
  measures: readonly Measure[],
  windows?: TimingWindows,
  wrongHands: readonly Hand[] = [],
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
  const errorsMs = notes.flatMap((note) => {
    const outcome = outcomes.get(note);
    return outcome?.kind === OutcomeKind.Hit ? [outcome.errorMs] : [];
  });
  return {
    ...total,
    stars: starsFor(total.accuracy),
    measures: perMeasure,
    timing: windows ? timingSummary(errorsMs, windows) : null,
    dynamics: null,
    touch: null,
    hands: byHand(notes, outcomes, wrongHands),
  };
}

function byHand(
  notes: readonly ScoreNote[],
  outcomes: ReadonlyMap<ScoreNote, NoteOutcome>,
  wrongHands: readonly Hand[],
): Summary['hands'] {
  const hands = [Hand.Right, Hand.Left].filter((hand) => notes.some((n) => n.hand === hand));
  if (hands.length < 2) return null;
  return hands.map((hand) => ({
    hand,
    tally: tally(
      notes.filter((note) => note.hand === hand),
      outcomes,
      wrongHands.filter((wrongHand) => wrongHand === hand).length,
    ),
  }));
}

export function timingSummary(errorsMs: readonly number[], windows: TimingWindows): TimingSummary {
  const count = (timing: Timing) =>
    errorsMs.filter((error) => timingOf(error, windows) === timing).length;
  return {
    errorsMs: [...errorsMs],
    early: count(Timing.Early),
    onTime: count(Timing.OnTime),
    late: count(Timing.Late),
    meanMs:
      errorsMs.length === 0 ? 0 : errorsMs.reduce((sum, error) => sum + error, 0) / errorsMs.length,
    windows,
  };
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
    if (!outcome || outcome.kind === OutcomeKind.Missed) result.missed++;
    else if (outcome.kind === OutcomeKind.Hit) result[outcome.grade]++;
    else result.correct++;
  }
  result.accuracy = accuracyOf(weights, wrong, notes.length);
  return result;
}
