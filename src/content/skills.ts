/**
 * Skill mastery (PLAN.md §2.4): how well the lessons that practice a skill went. Mastery is
 * the average best accuracy of its lessons (0 for one not played yet); its level uses the
 * same thresholds as the 2 and 3 star ratings. A skill with exercises of its own (e.g.
 * sight-reading drills, which are new each time) counts the accuracy of its latest exercises.
 */
import { STAR_THRESHOLDS } from '../engine/scoring';
import { Course, SKILLS, type Skill, type Unit } from './courses';

export const SkillLevel = {
  NotStarted: 'notStarted',
  Learning: 'learning',
  Good: 'good',
  Mastered: 'mastered',
} as const;
export type SkillLevel = (typeof SkillLevel)[keyof typeof SkillLevel];

export interface SkillProgress {
  skill: Skill;
  /** Lessons that practice it. */
  lessons: number;
  /** Of those, how many were played at least once; plus the exercises counted. */
  played: number;
  /** The exercises counted (skills with exercises of their own). */
  exercises: number;
  /** 0–1 */
  mastery: number;
  level: SkillLevel;
}

/**
 * @param skills the skills to report, in this order
 * @param bestAccuracyOf a lesson's best accuracy, or null if it was never played
 * @param exercisesOf the accuracy of the latest exercises that practice a skill
 */
export function skillProgress(
  skills: readonly Skill[],
  units: readonly Unit[],
  bestAccuracyOf: (lessonId: string) => number | null,
  exercisesOf: (skill: Skill) => readonly number[] = () => [],
): SkillProgress[] {
  const lessons = units.flatMap((unit) => unit.lessons);
  return skills.map((skill) => {
    const fromLessons = lessons
      .filter((lesson) => lesson.skills.includes(skill))
      .map((lesson) => bestAccuracyOf(lesson.id));
    const exercises = exercisesOf(skill);
    const accuracies = [...fromLessons, ...exercises];
    const played = accuracies.filter((accuracy) => accuracy !== null).length;
    const mastery =
      accuracies.length === 0
        ? 0
        : accuracies.reduce<number>((sum, accuracy) => sum + (accuracy ?? 0), 0) /
          accuracies.length;
    return {
      skill,
      lessons: fromLessons.length,
      played,
      exercises: exercises.length,
      mastery,
      level: levelOf(played, mastery),
    };
  });
}

function levelOf(played: number, mastery: number): SkillLevel {
  if (played === 0) return SkillLevel.NotStarted;
  if (mastery >= STAR_THRESHOLDS[2] - 1e-9) return SkillLevel.Mastered;
  if (mastery >= STAR_THRESHOLDS[1] - 1e-9) return SkillLevel.Good;
  return SkillLevel.Learning;
}

/** What a lesson can do for a skill (Home › Skills, a skill opened). */
export const SkillStep = {
  /** Open, not played yet. */
  Play: 'play',
  /** Played, short of three stars. */
  Redo: 'redo',
  /** Three stars: nothing more to gain. */
  Done: 'done',
  /** In a unit not open yet. */
  Locked: 'locked',
} as const;
export type SkillStep = (typeof SkillStep)[keyof typeof SkillStep];

export interface SkillLesson {
  id: string;
  /** Its unit's number, from 1. */
  unit: number;
  /** Best accuracy, or null if never played. */
  accuracy: number | null;
  step: SkillStep;
  /** How much the skill's mastery rises if it's played at three-star accuracy. */
  gain: number;
}

export interface SkillPlan {
  /** Lessons to play or redo, most to gain first; then those done; then locked, in order. */
  lessons: SkillLesson[];
  /** The level to reach next (null once mastered). */
  next: SkillLevel | null;
  /** How many of the first lessons, at three stars, reach the next level (0: they can't yet). */
  needed: number;
  /** All the lessons open now can add, at three stars. */
  gain: number;
}

/**
 * What raises a skill: its lessons with what each can add to its mastery at three stars, and how
 * many of them reach the next level. Mastery being an average, a lesson adds what it's short of
 * three stars over the number of lessons and exercises counted.
 */
export function skillPlan(
  progress: SkillProgress,
  units: readonly Unit[],
  isLocked: (lessonId: string) => boolean,
  bestAccuracyOf: (lessonId: string) => number | null,
): SkillPlan {
  const target = STAR_THRESHOLDS[2];
  const counted = progress.lessons + progress.exercises;
  const lessons = units.flatMap((unit, index) =>
    unit.lessons
      .filter((lesson) => lesson.skills.includes(progress.skill))
      .map((lesson): SkillLesson => {
        const accuracy = bestAccuracyOf(lesson.id);
        const step = isLocked(lesson.id)
          ? SkillStep.Locked
          : accuracy === null
            ? SkillStep.Play
            : accuracy >= target - 1e-9
              ? SkillStep.Done
              : SkillStep.Redo;
        const gain =
          step === SkillStep.Play || step === SkillStep.Redo
            ? (target - (accuracy ?? 0)) / counted
            : 0;
        return { id: lesson.id, unit: index + 1, accuracy, step, gain };
      }),
  );
  const open = lessons
    .filter((lesson) => lesson.step === SkillStep.Play || lesson.step === SkillStep.Redo)
    .sort((a, b) => b.gain - a.gain);
  const rest = (step: SkillStep) => lessons.filter((lesson) => lesson.step === step);
  const next =
    progress.level === SkillLevel.Mastered
      ? null
      : progress.level === SkillLevel.Good
        ? SkillLevel.Mastered
        : SkillLevel.Good;
  const needs = next === SkillLevel.Mastered ? STAR_THRESHOLDS[2] : STAR_THRESHOLDS[1];
  let mastery = progress.mastery;
  let needed = 0;
  if (next) {
    for (const lesson of open) {
      if (mastery >= needs - 1e-9) break;
      mastery += lesson.gain;
      needed++;
    }
    if (mastery < needs - 1e-9) needed = 0;
  }
  return {
    lessons: [...open, ...rest(SkillStep.Done), ...rest(SkillStep.Locked)],
    next,
    needed,
    gain: open.reduce((sum, lesson) => sum + lesson.gain, 0),
  };
}

/** The areas skills are shown in (Home › Skills), each in the course's order. */
export const SkillArea = {
  KeysAndHands: 'keysAndHands',
  Rhythm: 'rhythm',
  Reading: 'reading',
  Musicianship: 'musicianship',
  /** The voice course. */
  Singing: 'singing',
  /** The theory course. */
  Theory: 'theory',
} as const;
export type SkillArea = (typeof SkillArea)[keyof typeof SkillArea];

export const SKILL_AREAS: Readonly<Record<SkillArea, readonly Skill[]>> = {
  [SkillArea.KeysAndHands]: [
    'keyboard',
    'finger-numbers',
    'rh-position',
    'lh-position',
    'hands-together',
    'scales',
    'thumb-under',
    'touch',
    'pedal',
    'shifts',
    'arpeggios',
    'independence',
  ],
  [SkillArea.Rhythm]: [
    'note-values',
    'rests',
    'eighth-notes',
    'steady-tempo',
    'compound-time',
    'syncopation',
  ],
  [SkillArea.Reading]: [
    'treble-clef',
    'bass-clef',
    'grand-staff',
    'accidentals',
    'key-signatures',
    'form',
    'sight-reading',
  ],
  [SkillArea.Musicianship]: ['dynamics', 'chords', 'accompaniment', 'minor-keys', 'ear-training'],
  [SkillArea.Singing]: [
    'posture',
    'breathing',
    'pitch-matching',
    'slides',
    'stepwise',
    'leaps',
    'singing-scales',
    'singing-by-ear',
    'reading-melodies',
    'singing-songs',
    'sight-singing',
  ],
  [SkillArea.Theory]: [
    'half-and-whole-steps',
    'interval-numbers',
    'interval-qualities',
    'hearing-intervals',
    'major-pattern',
    'scale-degrees',
    'tonic-and-home',
    'minor-pattern',
    'key-signature-order',
    'circle-of-fifths',
    'relative-keys',
    'transposing',
    'triad-qualities',
    'chord-inversions',
    'seventh-chords',
    'roman-numerals',
    'dominant-pull',
    'cadences',
  ],
};

/** The areas of each course's skills, in the order Home shows them. */
export const COURSE_SKILL_AREAS: Readonly<Record<Course, readonly SkillArea[]>> = {
  [Course.Piano]: [
    SkillArea.KeysAndHands,
    SkillArea.Rhythm,
    SkillArea.Reading,
    SkillArea.Musicianship,
  ],
  [Course.Voice]: [SkillArea.Singing],
  [Course.Theory]: [SkillArea.Theory],
};

/** A course's skills, in the course's order. */
export const courseSkills = (course: Course): readonly Skill[] =>
  SKILLS.filter((skill) =>
    COURSE_SKILL_AREAS[course].some((area) => SKILL_AREAS[area].includes(skill)),
  );
