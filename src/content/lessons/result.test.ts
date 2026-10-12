import { describe, expect, it } from 'vitest';
import type { LessonStep } from './lesson';
import { lessonResult } from './result';

const step = (type: LessonStep['type']) => ({ type }) as LessonStep;

describe('lessonResult', () => {
  const steps = [step('explain'), step('find'), step('exercise'), step('exercise')];

  it('takes the weakest graded step’s stars and the average accuracy', () => {
    const result = lessonResult(
      steps,
      new Map([
        [1, { stars: 3, accuracy: 1 }],
        [2, { stars: 2, accuracy: 0.85 }],
        [3, { stars: 3, accuracy: 0.95 }],
      ]),
    );
    expect(result.stars).toBe(2);
    expect(result.accuracy).toBeCloseTo(0.9333, 3);
  });

  it('counts skipped steps as zero', () => {
    expect(lessonResult(steps, new Map([[1, { stars: 3, accuracy: 1 }]]))).toMatchObject({
      stars: 0,
    });
  });

  it('gives three stars to a lesson with nothing graded', () => {
    expect(lessonResult([step('explain')], new Map())).toEqual({ stars: 3, accuracy: 1 });
  });
});
