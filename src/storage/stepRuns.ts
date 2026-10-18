/**
 * Every finished try of a lesson's graded steps (exercises, note quizzes, rhythms): when, and
 * how it went. A lesson's own result keeps only its best; this keeps the history, shown on
 * each step (best, last, the last few as a trend, and all of them on request).
 */
import { create } from 'zustand';
import { db, type StepRunRow } from './db';

export type StepRun = Pick<StepRunRow, 'at' | 'stars' | 'accuracy' | 'passed'>;

/** A lesson step's key: "lesson:<id>:<step index>" (as for recordings). */
export const stepKey = (lessonId: string, index: number) => `lesson:${lessonId}:${index}`;

export const useStepRuns = create<{ byKey: Readonly<Record<string, readonly StepRun[]>> }>(() => ({
  byKey: {},
}));

/** Loads the tries of a lesson's steps (keys starting with `lesson:<id>:`), oldest first. */
export async function loadStepRuns(lessonId: string): Promise<void> {
  try {
    const rows = await db.stepRuns.where('key').startsWith(`lesson:${lessonId}:`).toArray();
    const byKey: Record<string, StepRun[]> = {};
    for (const { key, at, stars, accuracy, passed } of rows.sort((a, b) => a.at - b.at)) {
      (byKey[key] ??= []).push({ at, stars, accuracy, ...(passed !== undefined && { passed }) });
    }
    useStepRuns.setState((state) => ({ byKey: { ...state.byKey, ...byKey } }));
  } catch (error) {
    console.error('Could not load the step history', error);
  }
}

export async function recordStepRun(
  key: string,
  { stars, accuracy, passed }: Pick<StepRun, 'stars' | 'accuracy' | 'passed'>,
  now = Date.now(),
): Promise<void> {
  const run: StepRun = { at: now, stars, accuracy, ...(passed !== undefined && { passed }) };
  useStepRuns.setState((state) => ({
    byKey: { ...state.byKey, [key]: [...(state.byKey[key] ?? []), run] },
  }));
  try {
    await db.stepRuns.add({ key, ...run });
  } catch (error) {
    console.error('Could not save the try', error);
  }
}

/** The best try: the most stars, then the best accuracy (the latest of equals). */
export function bestRun(runs: readonly StepRun[]): StepRun | null {
  return runs.reduce<StepRun | null>(
    (best, run) =>
      !best || run.stars > best.stars || (run.stars === best.stars && run.accuracy >= best.accuracy)
        ? run
        : best,
    null,
  );
}
