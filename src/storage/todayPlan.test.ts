import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SuggestionKind } from '../content/suggestions';
import { db } from './db';
import { useProgress } from './progress';
import {
  ensureTodayPlan,
  isDone,
  loadTodayPlan,
  markPracticed,
  suggestMore,
  useTodayPlan,
} from './todayPlan';

const MORNING = new Date(2026, 9, 16, 9).getTime();
const EVENING = new Date(2026, 9, 16, 20).getTime();
const TOMORROW = new Date(2026, 9, 17, 9).getTime();

beforeEach(async () => {
  await db.settings.clear();
  useTodayPlan.setState({ plan: null });
  useProgress.setState({ results: {}, log: [], days: {} });
});

describe('today’s plan', () => {
  it('is made once a day, starting with the first lesson for a new learner', async () => {
    ensureTodayPlan(MORNING);
    const plan = useTodayPlan.getState().plan!;
    expect(plan.day).toBe('2026-10-16');
    expect(plan.items[0]).toMatchObject({
      kind: SuggestionKind.Next,
      target: { kind: 'lesson', id: 'u1-l1' },
    });

    ensureTodayPlan(EVENING);
    expect(useTodayPlan.getState().plan).toBe(plan);
    ensureTodayPlan(TOMORROW);
    expect(useTodayPlan.getState().plan?.day).toBe('2026-10-17');

    // Saved, so it survives a restart.
    useTodayPlan.setState({ plan: null });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await loadTodayPlan();
    expect(useTodayPlan.getState().plan?.day).toBe('2026-10-17');
  });

  it('ticks items played since they were suggested, or practiced in a loop', () => {
    ensureTodayPlan(MORNING);
    const [first, second] = useTodayPlan.getState().plan!.items;
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
    expect(isDone(useTodayPlan.getState().plan!.items[1]!, {})).toBe(true);
  });

  it('adds more suggestions without repeating any', () => {
    ensureTodayPlan(MORNING);
    const before = useTodayPlan
      .getState()
      .plan!.items.map((i) => `${i.target.kind}:${i.target.id}`);
    suggestMore(EVENING);
    const after = useTodayPlan.getState().plan!.items.map((i) => `${i.target.kind}:${i.target.id}`);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(new Set(after).size).toBe(after.length);
  });
});
