import { describe, expect, it } from 'vitest';
import { courseStates, TryKind, tryItems, whyLesson } from './courseLinks';
import { Course, COURSE_UNITS, findLesson, lessonOrder, THEORY_UNITS } from './courses';
import { EarLevel } from './earTraining';
import { loadLesson, StepType } from './lessons';
import { isSongId } from './songs';
import { isValueOf } from '../lib/values';

const THEORY_LESSONS = THEORY_UNITS.flatMap((unit) => unit.lessons);
const lesson = (id: string) => THEORY_LESSONS.find((l) => l.id === id)!;

/** States with these lessons done (one star each). */
const statesWith = (...done: string[]) => courseStates((id) => (done.includes(id) ? 1 : 0));

/** Every lesson of a unit, for opening what comes after it. */
const unitLessons = (course: Course, unit: string) =>
  COURSE_UNITS[course].find(({ id }) => id === unit)!.lessons.map(({ id }) => id);
/** Every lesson of a course up to a unit, so it's open. */
const upTo = (course: Course, unit: string) => {
  const units = COURSE_UNITS[course];
  const last = units.findIndex(({ id }) => id === unit);
  return units.slice(0, last + 1).flatMap(({ id }) => unitLessons(course, id));
};

describe('the links in the theory course', () => {
  it('name lessons that exist in the piano and voice courses', () => {
    for (const { id, builds } of THEORY_LESSONS) {
      expect(builds.length, id).toBeGreaterThan(0);
      for (const lessonId of builds) {
        expect(findLesson(lessonId)?.course, `${id} builds on ${lessonId}`).toBeOneOf([
          Course.Piano,
          Course.Voice,
        ]);
      }
    }
  });

  it('suggest songs and levels that exist', () => {
    for (const { id, tryIt } of THEORY_LESSONS) {
      if (tryIt.song !== null) expect(isSongId(tryIt.song), id).toBe(true);
      if (tryIt.ear !== null) expect(isValueOf(EarLevel, tryIt.ear), id).toBe(true);
    }
  });

  it('recap only what the lesson builds on', async () => {
    for (const { id, builds } of THEORY_LESSONS) {
      const { steps } = await loadLesson(id);
      for (const step of steps) {
        if (step.type !== StepType.Explain) continue;
        for (const lessonId of step.recap) expect(builds, id).toContain(lessonId);
      }
    }
  });
});

describe('whyLesson', () => {
  it('finds the theory lesson built on a lesson', () => {
    expect(whyLesson('u8-l1', statesWith())).toBe('t1-l1');
  });

  it('has nothing for a lesson no theory lesson builds on', () => {
    expect(whyLesson('u1-l1', statesWith())).toBeNull();
  });

  it('leaves out a theory lesson that is still locked', () => {
    expect(whyLesson('u6-l2', statesWith())).toBeNull();
    expect(whyLesson('u6-l2', statesWith('t1-l1', 't1-l2'))).toBe('t1-l3');
  });

  it('prefers the lesson not done yet, and keeps the link when all are', () => {
    expect(whyLesson('v5-l2', statesWith('t1-l1'))).toBe('t1-l2');
    expect(whyLesson('v5-l2', statesWith('t1-l1', 't1-l2'))).toBe('t1-l3');
    expect(whyLesson('v5-l2', statesWith('t1-l1', 't1-l2', 't1-l3'))).toBe('t1-l2');
  });
});

describe('tryItems', () => {
  it('offers nothing from a course not started', () => {
    expect(tryItems(lesson('t1-l1'), Course.Piano, statesWith())).toEqual([]);
    expect(tryItems(lesson('t1-l1'), Course.Voice, statesWith())).toEqual([]);
  });

  it('offers only the lessons already open', () => {
    expect(tryItems(lesson('t1-l1'), Course.Piano, statesWith('u1-l1'))).not.toContainEqual({
      kind: TryKind.Lesson,
      id: 'u8-l1',
    });
    const items = tryItems(lesson('t1-l1'), Course.Piano, statesWith(...upTo(Course.Piano, 'u7')));
    expect(items).toContainEqual({ kind: TryKind.Lesson, id: 'u8-l1' });
    expect(items).not.toContainEqual({ kind: TryKind.Lesson, id: 'v6-l1' });
  });

  it('offers lessons from both courses when both are open', () => {
    const states = statesWith(...upTo(Course.Piano, 'u7'), ...upTo(Course.Voice, 'v5'));
    expect(tryItems(lesson('t1-l1'), Course.Piano, states).slice(0, 2)).toEqual([
      { kind: TryKind.Lesson, id: 'u8-l1' },
      { kind: TryKind.Lesson, id: 'v6-l1' },
    ]);
  });

  it('offers a song once its unit is open', () => {
    const song = { kind: TryKind.Song, id: 'amazing-grace', course: Course.Piano };
    expect(tryItems(lesson('t1-l4'), Course.Piano, statesWith('u1-l1'))).not.toContainEqual(song);
    const states = statesWith(...upTo(Course.Piano, 'u6'));
    expect(tryItems(lesson('t1-l4'), Course.Piano, states)).toContainEqual(song);
  });

  it('offers the voice its songs once it has started singing them', () => {
    const song = { kind: TryKind.Song, id: 'ode-to-joy', course: Course.Voice };
    expect(tryItems(lesson('t1-l1'), Course.Voice, statesWith())).not.toContainEqual(song);
    const states = statesWith(...upTo(Course.Voice, 'v7'), 'v8-l1');
    expect(tryItems(lesson('t1-l1'), Course.Voice, states)).toContainEqual(song);
  });

  it('offers an ear training level once it is open in that course', () => {
    const ear = (course: Course) => ({ kind: TryKind.Ear, id: EarLevel.Intervals, course });
    const piano = statesWith(...unitLessons(Course.Piano, 'u1'));
    expect(tryItems(lesson('t1-l2'), Course.Piano, piano)).toContainEqual(ear(Course.Piano));
    expect(tryItems(lesson('t1-l2'), Course.Voice, piano)).not.toContainEqual(ear(Course.Voice));
    const voice = statesWith(...upTo(Course.Voice, 'v5'));
    expect(tryItems(lesson('t1-l2'), Course.Voice, voice)).toContainEqual(ear(Course.Voice));
  });

  it('has nothing for a lesson of the other courses', () => {
    const piano = COURSE_UNITS[Course.Piano][0]!.lessons[0]!;
    expect(tryItems(piano, Course.Piano, statesWith(...lessonOrder(Course.Piano)))).toEqual([]);
  });
});
