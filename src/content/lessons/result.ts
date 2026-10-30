import { isGraded, type LessonStep, StepType } from './lesson';

export interface StepResult {
  stars: number;
  accuracy: number;
}

/**
 * A lesson's result from its graded steps (all but explanations and warm-ups): the weakest step's stars and
 * the average accuracy. Skipped steps count as zero; a lesson with nothing graded earns 3.
 */
export function lessonResult(
  steps: readonly LessonStep[],
  results: ReadonlyMap<number, StepResult>,
): StepResult {
  const graded = steps.flatMap((step, index) => (isGraded(step) ? [index] : []));
  if (graded.length === 0) return { stars: 3, accuracy: 1 };
  const outcomes = graded.map((index) => results.get(index) ?? { stars: 0, accuracy: 0 });
  return {
    stars: Math.min(...outcomes.map((result) => result.stars)),
    accuracy: outcomes.reduce((sum, result) => sum + result.accuracy, 0) / outcomes.length,
  };
}

/** A try at a graded step from an earlier visit. */
export interface EarlierTry extends StepResult {
  /** It passed the step (unknown for tries kept before this was saved). */
  passed?: boolean;
}

/** What earlier visits achieved on a graded step: its best result, and whether it was passed. */
export interface EarlierStep {
  result: StepResult;
  passed: boolean;
}

const better = (a: StepResult, b: StepResult): StepResult =>
  b.stars > a.stars || (b.stars === a.stars && b.accuracy > a.accuracy) ? b : a;

/** The better of two results for each step. */
export function bestResults(
  a: ReadonlyMap<number, StepResult>,
  b: ReadonlyMap<number, StepResult>,
): Map<number, StepResult> {
  const merged = new Map(a);
  for (const [index, result] of b) {
    const other = merged.get(index);
    merged.set(index, other ? better(other, result) : result);
  }
  return merged;
}

/**
 * Earlier visits' results for a lesson's graded steps, so a step done before can be skipped:
 * each step's best try, passed if any try passed it with the stars the step asks for now. A
 * lesson finished before tries were kept has only its own best: it stands in for the steps
 * without any try.
 */
export function earlierSteps(
  steps: readonly LessonStep[],
  triesOf: (index: number) => readonly EarlierTry[],
  lessonBest: StepResult | null,
): Map<number, EarlierStep> {
  const earlier = new Map<number, EarlierStep>();
  steps.forEach((step, index) => {
    if (!isGraded(step)) return;
    const tries = triesOf(index);
    if (tries.length === 0) {
      if (lessonBest) earlier.set(index, { result: lessonBest, passed: true });
      return;
    }
    const minStars = step.type === StepType.Find ? 0 : step.pass.minStars;
    earlier.set(index, {
      result: tries.reduce<StepResult>(better, tries[0]!),
      passed: tries.some((done) => (done.passed ?? true) && done.stars >= minStars),
    });
  });
  return earlier;
}

/**
 * The steps earlier visits got through: graded steps passed, and explanations and warm-ups that
 * were read, which is known when the lesson was finished or a step after them was tried.
 */
export function earlierDone(
  steps: readonly LessonStep[],
  earlier: ReadonlyMap<number, EarlierStep>,
  finished: boolean,
): Set<number> {
  const lastTried = Math.max(-1, ...earlier.keys());
  const done = new Set<number>();
  steps.forEach((step, index) => {
    if (isGraded(step) ? earlier.get(index)?.passed : finished || index < lastTried) {
      done.add(index);
    }
  });
  return done;
}

/**
 * Where to pick a lesson up: its first step not done. A lesson not started, or done throughout,
 * starts at the beginning.
 */
export function resumeAt(steps: readonly LessonStep[], done: ReadonlySet<number>): number {
  const index = steps.findIndex((_, i) => !done.has(i));
  return index === -1 ? 0 : index;
}
