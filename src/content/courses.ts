/**
 * Course structure (PLAN.md §7): units in order, each with its lessons in order.
 * Titles live in `locales/<lang>/courses.json`; note names in them are variables.
 *
 * Unlock rules (enforced once progress is saved, milestone 1.7):
 * - lessons unlock one after another within a unit (the previous one needs ≥ 1 star);
 * - a unit with `unlock.previousUnitMinStars` unlocks when every lesson of the previous unit
 *   has at least that many stars.
 */
import { parseNote, type Pitch } from '../theory/pitch';
import data from './courses.json';

export interface CourseLesson {
  id: string;
  titleVars: Record<string, Pitch>;
}

export interface Unit {
  id: string;
  textVars: Record<string, Pitch>;
  unlock: { previousUnitMinStars: number } | null;
  lessons: CourseLesson[];
}

const vars = (input: Record<string, string> | undefined) =>
  Object.fromEntries(Object.entries(input ?? {}).map(([name, note]) => [name, parseNote(note)]));

export const UNITS: readonly Unit[] = data.units.map((unit) => ({
  id: unit.id,
  textVars: vars((unit as { textVars?: Record<string, string> }).textVars),
  unlock: (unit as { unlock?: Unit['unlock'] }).unlock ?? null,
  lessons: unit.lessons.map((lesson) => ({
    id: lesson.id,
    titleVars: vars((lesson as { titleVars?: Record<string, string> }).titleVars),
  })),
}));

export const LESSON_ORDER: readonly string[] = UNITS.flatMap((unit) =>
  unit.lessons.map((lesson) => lesson.id),
);

export function findLesson(id: string): { unit: Unit; lesson: CourseLesson; index: number } | null {
  for (const unit of UNITS) {
    const lesson = unit.lessons.find((l) => l.id === id);
    if (lesson) return { unit, lesson, index: LESSON_ORDER.indexOf(id) };
  }
  return null;
}

export function nextLessonId(id: string): string | null {
  const index = LESSON_ORDER.indexOf(id);
  return index >= 0 ? (LESSON_ORDER[index + 1] ?? null) : null;
}
