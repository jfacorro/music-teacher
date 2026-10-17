/**
 * Course structure (PLAN.md §7): units in order, each with its lessons in order.
 * Titles live in `locales/<lang>/courses.json`; note names in them are variables.
 *
 * Units are grouped in levels (Beginner, Elementary, Late elementary, Early intermediate), each
 * unit naming its own; levels follow the course order.
 *
 * Unlock rules (enforced once progress is saved, milestone 1.7):
 * - lessons unlock one after another within a unit (the previous one needs ≥ 1 star);
 * - a unit with `unlock.previousUnitMinStars` unlocks when every lesson of the previous unit
 *   has at least that many stars.
 */
import { isValueOf } from '../lib/values';
import { parseNote, type Pitch } from '../theory/pitch';
import data from './courses.json';

/** What lessons practice (PLAN.md §2.4), in curriculum order. Names: courses.json › skills. */
export const SKILLS = [
  'keyboard',
  'finger-numbers',
  'rh-position',
  'lh-position',
  'note-values',
  'rests',
  'eighth-notes',
  'steady-tempo',
  'treble-clef',
  'bass-clef',
  'grand-staff',
  'dynamics',
  'hands-together',
  'chords',
  'accompaniment',
  'scales',
  'thumb-under',
  'accidentals',
  'minor-keys',
  'sight-reading',
  'ear-training',
] as const;

export type Skill = (typeof SKILLS)[number];

/** Skills practiced by exercises of their own rather than lessons (e.g. sight-reading drills). */
export const EXERCISE_SKILLS: readonly Skill[] = ['sight-reading', 'ear-training'];

export interface CourseLesson {
  id: string;
  titleVars: Record<string, Pitch>;
  skills: Skill[];
}

function skills(lessonId: string, input: readonly string[] | undefined): Skill[] {
  return (input ?? []).map((skill) => {
    if (!(SKILLS as readonly string[]).includes(skill)) {
      throw new Error(`courses.json › ${lessonId}: unknown skill "${skill}"`);
    }
    return skill as Skill;
  });
}

/** Groups of units, easiest first. Names: screens.json › course.levels. */
export const CourseLevel = {
  /** Units 1–4: the keyboard, rhythm, both clefs, one hand at a time. */
  Beginner: 'beginner',
  /** Units 5–8: hands together, chords, scales, sharps and flats. */
  Elementary: 'elementary',
  /** Units 9–11: touch, the sustain pedal, moving around the keyboard. */
  LateElementary: 'lateElementary',
  /** Units 12–14: more keys, rhythm and form, two independent hands. */
  EarlyIntermediate: 'earlyIntermediate',
} as const;
export type CourseLevel = (typeof CourseLevel)[keyof typeof CourseLevel];

export const COURSE_LEVELS: readonly CourseLevel[] = Object.values(CourseLevel);

function level(unitId: string, input: unknown): CourseLevel {
  if (!isValueOf(CourseLevel, input)) {
    throw new Error(`courses.json › ${unitId}: unknown level "${String(input)}"`);
  }
  return input;
}

export interface Unit {
  id: string;
  level: CourseLevel;
  textVars: Record<string, Pitch>;
  unlock: { previousUnitMinStars: number } | null;
  lessons: CourseLesson[];
}

const vars = (input: Record<string, string> | undefined) =>
  Object.fromEntries(Object.entries(input ?? {}).map(([name, note]) => [name, parseNote(note)]));

export const UNITS: readonly Unit[] = data.units.map((unit) => ({
  id: unit.id,
  level: level(unit.id, (unit as { level?: unknown }).level),
  textVars: vars((unit as { textVars?: Record<string, string> }).textVars),
  unlock: (unit as { unlock?: Unit['unlock'] }).unlock ?? null,
  lessons: unit.lessons.map((lesson) => ({
    id: lesson.id,
    titleVars: vars((lesson as { titleVars?: Record<string, string> }).titleVars),
    skills: skills(lesson.id, (lesson as { skills?: string[] }).skills),
  })),
}));

export interface LevelUnits {
  level: CourseLevel;
  /** The level's units, with their numbers in the course (from 1). */
  units: { unit: Unit; number: number }[];
}

/** The levels that have units, in course order, each with its units. */
export function unitsByLevel(units: readonly Unit[] = UNITS): LevelUnits[] {
  return COURSE_LEVELS.map((courseLevel) => ({
    level: courseLevel,
    units: units.flatMap((unit, index) =>
      unit.level === courseLevel ? [{ unit, number: index + 1 }] : [],
    ),
  })).filter(({ units: inLevel }) => inLevel.length > 0);
}

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
