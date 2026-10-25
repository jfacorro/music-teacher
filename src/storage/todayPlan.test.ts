import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Course } from '../content/courses';
import { SuggestionKind } from '../content/suggestions';
import { db } from './db';
import { useProgress } from './progress';
import {
  ensureTodayPlan,
  isDone,
  loadTodayPlan,
  markPracticed,
  suggestMore,
  todaysWeakSpot,
  useTodayPlan,
} from './todayPlan';

const MORNING = new Date(2026, 9, 16, 9).getTime();
const EVENING = new Date(2026, 9, 16, 20).getTime();
const TOMORROW = new Date(2026, 9, 17, 9).getTime();

beforeEach(async () => {
  await db.settings.clear();
  useTodayPlan.setState({ plans: {} });
  useProgress.setState({ results: {}, log: [], days: {} });
});

const pianoPlan = () => useTodayPlan.getState().plans[Course.Piano];

describe('today’s plan', () => {
  it('is made once a day, starting with the first lesson for a new learner', async () => {
    ensureTodayPlan(Course.Piano, MORNING);
    const plan = pianoPlan()!;
    expect(plan.day).toBe('2026-10-16');
    expect(plan.items[0]).toMatchObject({
      kind: SuggestionKind.Next,
      target: { kind: 'lesson', id: 'u1-l1' },
    });

    ensureTodayPlan(Course.Piano, EVENING);
    expect(pianoPlan()).toBe(plan);
    ensureTodayPlan(Course.Piano, TOMORROW);
    expect(pianoPlan()?.day).toBe('2026-10-17');

    // Saved, so it survives a restart.
    useTodayPlan.setState({ plans: {} });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await loadTodayPlan();
    expect(pianoPlan()?.day).toBe('2026-10-17');
  });

  it('keeps a plan for each course, the voice’s from its own lessons', async () => {
    ensureTodayPlan(Course.Piano, MORNING);
    ensureTodayPlan(Course.Voice, MORNING);
    expect(useTodayPlan.getState().plans[Course.Voice]?.items).toEqual([
      expect.objectContaining({
        kind: SuggestionKind.Next,
        target: { kind: 'lesson', id: 'v1-l1' },
      }),
    ]);
    expect(pianoPlan()?.items[0]?.target.id).toBe('u1-l1');

    useTodayPlan.setState({ plans: {} });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await loadTodayPlan();
    expect(useTodayPlan.getState().plans[Course.Voice]?.items[0]?.target.id).toBe('v1-l1');
  });

  it('ticks items played since they were suggested, or practiced in a loop', () => {
    ensureTodayPlan(Course.Piano, MORNING);
    const [first, second] = pianoPlan()!.items;
    const played = {
      'lesson:u1-l1': {
        key: 'lesson:u1-l1',
        bestStars: 2,
        bestAccuracy: 0.9,
        attempts: 1,
        completedAt: EVENING,
        lastPlayedAt: EVENING,
      },
    };
    expect(isDone(first!, {})).toBe(false);
    expect(isDone(first!, played)).toBe(true);

    markPracticed(`${second!.target.kind}:${second!.target.id}`);
    expect(isDone(pianoPlan()!.items[1]!, {})).toBe(true);
  });

  it('finds today’s weak spot in a song, only on the day it was suggested', () => {
    const weak = {
      kind: SuggestionKind.WeakSpot,
      target: { kind: 'song', id: 'ode-to-joy' },
      bars: { first: 1, last: 1 },
      since: MORNING,
    } as const;
    const plans = { [Course.Piano]: { day: '2026-10-16', items: [weak] } };
    expect(todaysWeakSpot(plans, 'song:ode-to-joy', EVENING)).toBe(weak);
    expect(todaysWeakSpot(plans, 'song:jingle-bells', EVENING)).toBeUndefined();
    expect(todaysWeakSpot(plans, 'song:ode-to-joy', TOMORROW)).toBeUndefined();
  });

  it('adds more suggestions without repeating any', () => {
    ensureTodayPlan(Course.Piano, MORNING);
    const before = pianoPlan()!.items.map((i) => `${i.target.kind}:${i.target.id}`);
    suggestMore(Course.Piano, EVENING);
    const after = pianoPlan()!.items.map((i) => `${i.target.kind}:${i.target.id}`);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(new Set(after).size).toBe(after.length);
  });
});
