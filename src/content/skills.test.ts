import { describe, expect, it } from 'vitest';
import { CourseLevel, type Unit } from './courses';
import { skillPlan, skillProgress } from './skills';

const unit: Unit = {
  id: 'u',
  level: CourseLevel.Beginner,
  textVars: {},
  unlock: null,
  lessons: [
    { id: 'a', titleVars: {}, builds: [], tryIt: { song: null, ear: null }, skills: ['keyboard'] },
    {
      id: 'b',
      titleVars: {},
      builds: [],
      tryIt: { song: null, ear: null },
      skills: ['keyboard', 'rh-position'],
    },
    {
      id: 'c',
      titleVars: {},
      builds: [],
      tryIt: { song: null, ear: null },
      skills: ['rh-position'],
    },
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
      exercises: 0,
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
      exercises: 2,
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

describe('skillPlan', () => {
  const units: Unit[] = [
    {
      ...unit,
      id: 'u1',
      lessons: [
        {
          id: 'a',
          titleVars: {},
          builds: [],
          tryIt: { song: null, ear: null },
          skills: ['treble-clef'],
        },
        {
          id: 'b',
          titleVars: {},
          builds: [],
          tryIt: { song: null, ear: null },
          skills: ['treble-clef'],
        },
        {
          id: 'c',
          titleVars: {},
          builds: [],
          tryIt: { song: null, ear: null },
          skills: ['treble-clef'],
        },
      ],
    },
    {
      ...unit,
      id: 'u2',
      lessons: [
        {
          id: 'd',
          titleVars: {},
          builds: [],
          tryIt: { song: null, ear: null },
          skills: ['treble-clef'],
        },
      ],
    },
  ];
  const planOf = (best: Record<string, number>, locked: readonly string[] = []) => {
    const accuracyOf = (id: string) => best[id] ?? null;
    const [progress] = skillProgress(['treble-clef'], units, accuracyOf);
    return skillPlan(progress!, units, (id) => locked.includes(id), accuracyOf);
  };

  it('lists what to play or redo, most to gain first, then what is done, then what is locked', () => {
    const plan = planOf({ a: 1, b: 0.75 }, ['d']);
    expect(plan.lessons.map(({ id, step, unit }) => [id, step, unit])).toEqual([
      ['c', 'play', 1],
      ['b', 'redo', 1],
      ['a', 'done', 1],
      ['d', 'locked', 2],
    ]);
    // What each adds at three stars (95%), over the 4 lessons counted.
    expect(plan.lessons[0]!.gain).toBeCloseTo(0.95 / 4);
    expect(plan.lessons[1]!.gain).toBeCloseTo(0.2 / 4);
    expect(plan.lessons[2]!.gain).toBe(0);
    expect(plan.lessons[3]!.gain).toBe(0);
    expect(plan.gain).toBeCloseTo(1.15 / 4);
  });

  it('counts how many lessons reach the next level', () => {
    // 43.75% now: three stars in c (+23.75%) and d (+23.75%) make 91%, past Good.
    const learning = planOf({ a: 1, b: 0.75 });
    expect(learning).toMatchObject({ next: 'good', needed: 2 });
    // Good (85%): mastered once b, c and d have three stars (+3.75% each).
    expect(planOf({ a: 1, b: 0.8, c: 0.8, d: 0.8 })).toMatchObject({ next: 'mastered', needed: 3 });
    expect(planOf({ a: 1, b: 1, c: 1, d: 1 })).toMatchObject({ next: null, needed: 0, gain: 0 });
  });

  it('needs none when the lessons open now cannot reach it', () => {
    // With d locked, three stars in c only make 67.5%.
    expect(planOf({ a: 1, b: 0.75 }, ['d'])).toMatchObject({ next: 'good', needed: 0 });
  });
});

describe('skill areas', () => {
  it('put every skill in exactly one area', async () => {
    const { SKILLS } = await import('./courses');
    const { SKILL_AREAS } = await import('./skills');
    const listed = Object.values(SKILL_AREAS).flat();
    expect([...listed].sort()).toEqual([...SKILLS].sort());
  });
});
