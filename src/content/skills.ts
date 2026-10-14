/**
 * Skill mastery (PLAN.md §2.4): how well the lessons that practice a skill went. Mastery is
 * the average best accuracy of its lessons (0 for one not played yet); its level uses the
 * same thresholds as the 2 and 3 star ratings.
 */
import { STAR_THRESHOLDS } from '../engine/scoring';
import type { Skill, Unit } from './courses';

export type SkillLevel = 'notStarted' | 'learning' | 'good' | 'mastered';

export interface SkillProgress {
  skill: Skill;
  /** Lessons that practice it. */
  lessons: number;
  /** Of those, how many were played at least once. */
  played: number;
  /** 0–1 */
  mastery: number;
  level: SkillLevel;
}

/**
 * @param skills the skills to report, in this order
 * @param bestAccuracyOf a lesson's best accuracy, or null if it was never played
 */
export function skillProgress(
  skills: readonly Skill[],
  units: readonly Unit[],
  bestAccuracyOf: (lessonId: string) => number | null,
): SkillProgress[] {
  const lessons = units.flatMap((unit) => unit.lessons);
  return skills.map((skill) => {
    const accuracies = lessons
      .filter((lesson) => lesson.skills.includes(skill))
      .map((lesson) => bestAccuracyOf(lesson.id));
    const played = accuracies.filter((accuracy) => accuracy !== null).length;
    const mastery =
      accuracies.length === 0
        ? 0
        : accuracies.reduce<number>((sum, accuracy) => sum + (accuracy ?? 0), 0) /
          accuracies.length;
    return { skill, lessons: accuracies.length, played, mastery, level: levelOf(played, mastery) };
  });
}

function levelOf(played: number, mastery: number): SkillLevel {
  if (played === 0) return 'notStarted';
  if (mastery >= STAR_THRESHOLDS[2] - 1e-9) return 'mastered';
  if (mastery >= STAR_THRESHOLDS[1] - 1e-9) return 'good';
  return 'learning';
}
