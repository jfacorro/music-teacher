/**
 * Which lessons are open (PLAN.md §7 unlock rules):
 * - the first unit is open; a later unit with `unlock.previousUnitMinStars` opens when every
 *   lesson of the previous unit has at least that many stars (a unit without a rule is open);
 * - inside an open unit, lessons open one after another: each needs the previous one done
 *   (at least one star).
 */
import type { Unit } from './courses';

export const LessonStatus = {
  Locked: 'locked',
  Available: 'available',
  Completed: 'completed',
} as const;
export type LessonStatus = (typeof LessonStatus)[keyof typeof LessonStatus];

export interface LessonState {
  status: LessonStatus;
  stars: number;
}

export function lessonStates(
  units: readonly Unit[],
  starsOf: (lessonId: string) => number,
): Map<string, LessonState> {
  const states = new Map<string, LessonState>();
  let previous: Unit | null = null;
  for (const unit of units) {
    const unitOpen =
      previous === null ||
      unit.unlock === null ||
      previous.lessons.every((lesson) => starsOf(lesson.id) >= unit.unlock!.previousUnitMinStars);
    let previousDone = true;
    for (const lesson of unit.lessons) {
      const stars = starsOf(lesson.id);
      const status: LessonStatus =
        !unitOpen || !previousDone
          ? LessonStatus.Locked
          : stars >= 1
            ? LessonStatus.Completed
            : LessonStatus.Available;
      states.set(lesson.id, { status, stars });
      previousDone = stars >= 1;
    }
    previous = unit;
  }
  return states;
}

/** The lesson to continue with: the first open one not done yet (null when all are done). */
export function nextLessonToPlay(
  units: readonly Unit[],
  states: ReadonlyMap<string, LessonState>,
): string | null {
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      if (states.get(lesson.id)?.status === LessonStatus.Available) return lesson.id;
    }
  }
  return null;
}

export function isUnitOpen(unit: Unit, states: ReadonlyMap<string, LessonState>): boolean {
  return unit.lessons.some((lesson) => states.get(lesson.id)?.status !== LessonStatus.Locked);
}
