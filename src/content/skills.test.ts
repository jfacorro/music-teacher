import { describe, expect, it } from 'vitest';
import { CourseLevel, type Unit } from './courses';
import { skillProgress } from './skills';

const unit: Unit = {
  id: 'u',
  level: CourseLevel.Beginner,
  textVars: {},
  unlock: null,
  lessons: [
    { id: 'a', titleVars: {}, skills: ['keyboard'] },
    { id: 'b', titleVars: {}, skills: ['keyboard', 'rh-position'] },
    { id: 'c', titleVars: {}, skills: ['rh-position'] },
  ],
};

describe('skillProgress', () => {
  it('averages the best accuracy of the lessons, counting unplayed ones as zero', () => {
    const best: Record<string, number> = { a: 1, b: 0.9 };
    const [keyboard, rh] = skillProgress(
      ['keyboard', 'rh-position'],
      [unit],
      (id) => best[id] ?? null,
    );
    expect(keyboard).toEqual({
      skill: 'keyboard',
      lessons: 2,
      played: 2,
      mastery: 0.95,
      level: 'mastered',
    });
    expect(rh).toMatchObject({ lessons: 2, played: 1, mastery: 0.45, level: 'learning' });
  });

  it('rates the level like the stars: 80% good, 95% mastered', () => {
    const level = (accuracy: number | null) =>
      skillProgress(['rh-position'], [unit], () => accuracy)[0]?.level;
    expect(level(null)).toBe('notStarted');
    expect(level(0)).toBe('learning');
    expect(level(0.79)).toBe('learning');
    expect(level(0.8)).toBe('good');
    expect(level(0.95)).toBe('mastered');
  });

  it('counts the latest exercises of a skill practiced outside lessons', () => {
    const drills = (skill: string) => (skill === 'sight-reading' ? [0.9, 0.7] : []);
    expect(skillProgress(['sight-reading'], [unit], () => 1, drills)[0]).toEqual({
      skill: 'sight-reading',
      lessons: 0,
      played: 2,
      mastery: 0.8,
      level: 'good',
    });
  });

  it('reports a skill no lesson practices as not started', () => {
    expect(skillProgress(['rests'], [unit], () => 1)[0]).toMatchObject({
      lessons: 0,
      level: 'notStarted',
    });
  });
});
