/**
 * Skill mastery (PLAN.md §2.4): how well the lessons that practice a skill went. Mastery is
 * the average best accuracy of its lessons (0 for one not played yet); its level uses the
 * same thresholds as the 2 and 3 star ratings. A skill with exercises of its own (e.g.
 * sight-reading drills, which are new each time) counts the accuracy of its latest exercises.
 */
import { STAR_THRESHOLDS } from '../engine/scoring';
import type { Skill, Unit } from './courses';

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
    const accuracies = [...fromLessons, ...exercisesOf(skill)];
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
