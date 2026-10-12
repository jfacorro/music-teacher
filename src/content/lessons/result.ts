import type { LessonStep } from './lesson';

export interface StepResult {
  stars: number;
  accuracy: number;
}

/**
 * A lesson's result from its graded steps (find and exercise): the weakest step's stars and
 * the average accuracy. Skipped steps count as zero; a lesson with nothing graded earns 3.
 */
export function lessonResult(
  steps: readonly LessonStep[],
  results: ReadonlyMap<number, StepResult>,
): StepResult {
  const graded = steps.flatMap((step, index) => (step.type === 'explain' ? [] : [index]));
  if (graded.length === 0) return { stars: 3, accuracy: 1 };
  const outcomes = graded.map((index) => results.get(index) ?? { stars: 0, accuracy: 0 });
  return {
    stars: Math.min(...outcomes.map((result) => result.stars)),
    accuracy: outcomes.reduce((sum, result) => sum + result.accuracy, 0) / outcomes.length,
  };
}
