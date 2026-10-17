import { describe, expect, it } from 'vitest';
import { CourseLevel, type Unit } from './courses';
import { isUnitFinished, isUnitOpen, lessonStates, nextLessonToPlay } from './unlock';

const unit = (id: string, lessons: string[], minStars?: number): Unit => ({
  id,
  level: CourseLevel.Beginner,
  textVars: {},
  unlock: minStars === undefined ? null : { previousUnitMinStars: minStars },
  lessons: lessons.map((lessonId) => ({ id: lessonId, titleVars: {}, skills: [] })),
});

const units = [unit('u1', ['a', 'b', 'c']), unit('u2', ['d', 'e'], 2)];
const statuses = (stars: Record<string, number>) => {
  const states = lessonStates(units, (id) => stars[id] ?? 0);
  return Object.fromEntries([...states].map(([id, state]) => [id, state.status]));
};

describe('lessonStates', () => {
  it('opens only the first lesson at the start', () => {
    expect(statuses({})).toEqual({
      a: 'available',
      b: 'locked',
      c: 'locked',
      d: 'locked',
      e: 'locked',
    });
  });

  it('opens lessons one after another', () => {
    expect(statuses({ a: 1 })).toMatchObject({ a: 'completed', b: 'available', c: 'locked' });
    expect(statuses({ a: 3, b: 2 })).toMatchObject({ b: 'completed', c: 'available' });
  });

  it('opens the next unit when every lesson has enough stars', () => {
    expect(statuses({ a: 3, b: 3, c: 1 })).toMatchObject({ c: 'completed', d: 'locked' });
    expect(statuses({ a: 3, b: 3, c: 2 })).toMatchObject({ d: 'available', e: 'locked' });
  });

  it('keeps stars with each lesson', () => {
    expect(lessonStates(units, (id) => (id === 'a' ? 2 : 0)).get('a')).toEqual({
      status: 'completed',
      stars: 2,
    });
  });

  it('opens units without a rule', () => {
    const open = [unit('u1', ['a']), unit('u2', ['b'])];
    expect(lessonStates(open, () => 0).get('b')?.status).toBe('available');
  });
});

describe('nextLessonToPlay', () => {
  it('suggests the first open lesson not done yet', () => {
    const states = lessonStates(units, (id) => ({ a: 3 })[id] ?? 0);
    expect(nextLessonToPlay(units, states)).toBe('b');
  });

  it('returns null when everything open is done', () => {
    const all = { a: 3, b: 3, c: 3, d: 3, e: 3 } as Record<string, number>;
    expect(
      nextLessonToPlay(
        units,
        lessonStates(units, (id) => all[id] ?? 0),
      ),
    ).toBeNull();
  });
});

describe('isUnitFinished', () => {
  it('needs every lesson of the unit done', () => {
    const some = lessonStates(units, (id) => (id === 'a' || id === 'b' ? 1 : 0));
    expect(isUnitFinished(units[0]!, some)).toBe(false);
    const all = lessonStates(units, (id) => (['a', 'b', 'c'].includes(id) ? 1 : 0));
    expect(isUnitFinished(units[0]!, all)).toBe(true);
    expect(isUnitFinished(units[1]!, all)).toBe(false);
  });
});

describe('isUnitOpen', () => {
  it('tells whether any lesson of a unit is open', () => {
    const states = lessonStates(units, () => 0);
    expect(isUnitOpen(units[0]!, states)).toBe(true);
    expect(isUnitOpen(units[1]!, states)).toBe(false);
  });
});
