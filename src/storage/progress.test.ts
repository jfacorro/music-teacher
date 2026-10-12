import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  dayOf,
  loadProgress,
  mergeResult,
  recordResult,
  streakDays,
  totalPracticeMinutes,
  useProgress,
} from './progress';

const at = (date: string, time = '18:00') => new Date(`${date}T${time}:00`).getTime();

describe('mergeResult', () => {
  it('keeps the best stars and accuracy and counts attempts', () => {
    const first = mergeResult(
      'lesson:a',
      undefined,
      { stars: 2, accuracy: 0.85, durationMs: 1 },
      100,
    );
    expect(first).toEqual({
      key: 'lesson:a',
      bestStars: 2,
      bestAccuracy: 0.85,
      attempts: 1,
      completedAt: 100,
      lastPlayedAt: 100,
    });
    const second = mergeResult('lesson:a', first, { stars: 1, accuracy: 0.9, durationMs: 1 }, 200);
    expect(second).toMatchObject({
      bestStars: 2,
      bestAccuracy: 0.9,
      attempts: 2,
      completedAt: 100,
      lastPlayedAt: 200,
    });
  });

  it('only marks completion once a run earns a star', () => {
    const failed = mergeResult(
      'lesson:a',
      undefined,
      { stars: 0, accuracy: 0.3, durationMs: 1 },
      100,
    );
    expect(failed.completedAt).toBeNull();
    expect(
      mergeResult('lesson:a', failed, { stars: 1, accuracy: 0.7, durationMs: 1 }, 300).completedAt,
    ).toBe(300);
  });
});

describe('streakDays', () => {
  const now = at('2026-10-13', '09:00');

  it('counts consecutive days ending today', () => {
    const log = ['2026-10-11', '2026-10-12', '2026-10-13'].map((day) => ({ at: at(day) }));
    expect(streakDays(log, now)).toBe(3);
  });

  it('keeps yesterday’s streak alive until today is over', () => {
    expect(streakDays([{ at: at('2026-10-11') }, { at: at('2026-10-12') }], now)).toBe(2);
  });

  it('breaks on a missed day', () => {
    expect(streakDays([{ at: at('2026-10-10') }, { at: at('2026-10-13') }], now)).toBe(1);
    expect(streakDays([{ at: at('2026-10-10') }], now)).toBe(0);
    expect(streakDays([], now)).toBe(0);
  });

  it('counts several runs on one day once', () => {
    expect(
      streakDays([{ at: at('2026-10-13', '08:00') }, { at: at('2026-10-13', '08:30') }], now),
    ).toBe(1);
  });
});

describe('totals', () => {
  it('adds up practice time and names local days', () => {
    expect(totalPracticeMinutes([{ durationMs: 90_000 }, { durationMs: 30_000 }])).toBe(2);
    expect(dayOf(at('2026-01-05', '23:30'))).toBe('2026-01-05');
  });
});

describe('recordResult', () => {
  beforeEach(async () => {
    await db.results.clear();
    await db.practiceLog.clear();
    useProgress.setState({ results: {}, log: [] });
  });

  it('saves results so they survive a reload', async () => {
    await recordResult('lesson', 'u1-l1', { stars: 3, accuracy: 1, durationMs: 60_000 }, 1000);
    await recordResult('song', 'ode-to-joy', { stars: 1, accuracy: 0.7, durationMs: 30_000 }, 2000);
    await recordResult('lesson', 'u1-l1', { stars: 2, accuracy: 0.9, durationMs: 50_000 }, 3000);

    useProgress.setState({ results: {}, log: [] }); // as after a restart
    await loadProgress();
    const { results, log } = useProgress.getState();
    expect(results['lesson:u1-l1']).toMatchObject({
      bestStars: 3,
      attempts: 2,
      lastPlayedAt: 3000,
    });
    expect(results['song:ode-to-joy']).toMatchObject({ bestStars: 1 });
    expect(log.map((entry) => [entry.kind, entry.refId, entry.stars])).toEqual([
      ['lesson', 'u1-l1', 3],
      ['song', 'ode-to-joy', 1],
      ['lesson', 'u1-l1', 2],
    ]);
  });
});
