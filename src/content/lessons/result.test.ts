import { describe, expect, it } from 'vitest';
import { type LessonStep, StepType } from './lesson';
import { bestResults, earlierDone, earlierSteps, lessonResult } from './result';

const step = (type: LessonStep['type']) => ({ type }) as LessonStep;

describe('lessonResult', () => {
  const steps = [
    step(StepType.Explain),
    step(StepType.Find),
    step(StepType.Exercise),
    step(StepType.Exercise),
  ];

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
    expect(lessonResult([step(StepType.Explain)], new Map())).toEqual({ stars: 3, accuracy: 1 });
  });

  it('leaves warm-ups out, and grades matching notes', () => {
    const voice = [step(StepType.WarmUp), step(StepType.Match)];
    expect(lessonResult(voice, new Map([[1, { stars: 2, accuracy: 0.8 }]]))).toEqual({
      stars: 2,
      accuracy: 0.8,
    });
  });
});

describe('earlierSteps', () => {
  const exercise = (minStars: number) =>
    ({ type: StepType.Exercise, pass: { minStars, dynamics: false } }) as LessonStep;
  const steps = [step(StepType.Explain), step(StepType.Find), exercise(1), exercise(2)];

  it('keeps each step’s best try, passed if any try passed it', () => {
    const tries = new Map([
      [1, [{ stars: 3, accuracy: 1, passed: true }]],
      [
        2,
        [
          { stars: 1, accuracy: 0.6, passed: true },
          { stars: 2, accuracy: 0.85, passed: true },
        ],
      ],
      [3, [{ stars: 1, accuracy: 0.7, passed: false }]],
    ]);
    const earlier = earlierSteps(steps, (i) => tries.get(i) ?? [], null);
    expect([...earlier]).toEqual([
      [1, { result: { stars: 3, accuracy: 1, passed: true }, passed: true }],
      [2, { result: { stars: 2, accuracy: 0.85, passed: true }, passed: true }],
      [3, { result: { stars: 1, accuracy: 0.7, passed: false }, passed: false }],
    ]);
  });

  it('judges tries kept without a verdict by the step’s stars to pass', () => {
    const earlier = earlierSteps(
      steps,
      (i) => (i === 3 ? [{ stars: 2, accuracy: 0.9 }] : []),
      null,
    );
    expect(earlier.get(3)?.passed).toBe(true);
  });

  it('lets a lesson finished before tries were kept stand in for its untried steps', () => {
    const best = { stars: 2, accuracy: 0.88 };
    const earlier = earlierSteps(steps, () => [], best);
    expect([...earlier.keys()]).toEqual([1, 2, 3]);
    expect(earlier.get(2)).toEqual({ result: best, passed: true });
  });

  it('makes a skipped step count with its earlier best, without zeroing the lesson', () => {
    const now = new Map([[2, { stars: 3, accuracy: 0.97 }]]);
    const before = new Map([
      [1, { stars: 3, accuracy: 1 }],
      [2, { stars: 2, accuracy: 0.85 }],
      [3, { stars: 3, accuracy: 0.95 }],
    ]);
    const merged = bestResults(now, before);
    expect(merged.get(2)).toEqual({ stars: 3, accuracy: 0.97 });
    expect(lessonResult(steps, merged).stars).toBe(3);
  });
});

describe('earlierDone', () => {
  const steps = [
    step(StepType.WarmUp),
    step(StepType.Explain),
    step(StepType.Explain),
    step(StepType.Sing),
    step(StepType.Sing),
  ];
  const tried = (passed: boolean) => ({ result: { stars: 1, accuracy: 0.5 }, passed });

  it('counts the passed steps, and what was read before a step that was tried', () => {
    const earlier = new Map([
      [3, tried(true)],
      [4, tried(false)],
    ]);
    expect([...earlierDone(steps, earlier, false)]).toEqual([0, 1, 2, 3]);
  });

  it('counts every reading step of a lesson finished before', () => {
    expect([...earlierDone(steps, new Map([[4, tried(true)]]), true)]).toEqual([0, 1, 2, 4]);
  });

  it('counts nothing on a first visit', () => {
    expect(earlierDone(steps, new Map(), false).size).toBe(0);
  });
});
