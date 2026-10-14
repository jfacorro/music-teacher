import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  activityTimer,
  dayOf,
  IDLE_MS,
  loadProgress,
  longestStreak,
  mergeResult,
  practicedDays,
  recentDays,
  recordPracticeTime,
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
    expect(streakDays(['2026-10-11', '2026-10-12', '2026-10-13'], now)).toBe(3);
  });

  it('keeps yesterday’s streak alive until today is over', () => {
    expect(streakDays(['2026-10-11', '2026-10-12'], now)).toBe(2);
  });

  it('breaks on a missed day', () => {
    expect(streakDays(['2026-10-10', '2026-10-13'], now)).toBe(1);
    expect(streakDays(['2026-10-10'], now)).toBe(0);
    expect(streakDays([], now)).toBe(0);
  });

  it('counts a day once', () => {
    expect(streakDays(['2026-10-13', '2026-10-13'], now)).toBe(1);
  });
});

describe('longestStreak', () => {
  it('finds the most days in a row, across months', () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(['2026-10-01'])).toBe(1);
    expect(
      longestStreak(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-05', '2026-10-06']),
    ).toBe(3);
    // Across the change from summer time (25 October 2026 in Europe).
    expect(longestStreak(['2026-10-26', '2026-10-24', '2026-10-25'])).toBe(3);
  });
});

describe('practice time', () => {
  it('adds up the days and names local days', () => {
    expect(totalPracticeMinutes({ '2026-10-12': 90_000, '2026-10-13': 30_000 })).toBe(2);
    expect(practicedDays({ '2026-10-12': 0, '2026-10-13': 5 })).toEqual(['2026-10-13']);
    expect(dayOf(at('2026-01-05', '23:30'))).toBe('2026-01-05');
  });

  it('lists the last days, oldest first, with no practice as zero', () => {
    const days = recentDays({ '2026-10-13': 60_000, '2026-10-11': 1000 }, 3, at('2026-10-13'));
    expect(days.map(({ day, ms }) => [day, ms])).toEqual([
      ['2026-10-11', 1000],
      ['2026-10-12', 0],
      ['2026-10-13', 60_000],
    ]);
  });

  it('counts time between key presses, up to a minute per gap', () => {
    let now = 0;
    const timer = activityTimer(() => now);
    now = 20_000;
    timer.activity();
    now = 200_000; // three minutes without a key: only one counts
    timer.activity();
    now = 210_000;
    expect(timer.stop()).toBe(20_000 + IDLE_MS + 10_000);
  });
});

describe('recordPracticeTime', () => {
  beforeEach(async () => {
    await db.practiceDays.clear();
    useProgress.setState({ days: {} });
  });

  it('adds to the day and survives a reload', async () => {
    await recordPracticeTime(60_000, at('2026-10-13', '08:00'));
    await recordPracticeTime(30_000, at('2026-10-13', '20:00'));
    await recordPracticeTime(10_000, at('2026-10-14', '08:00'));
    await recordPracticeTime(0, at('2026-10-15'));
    useProgress.setState({ days: {} }); // as after a restart
    await loadProgress();
    expect(useProgress.getState().days).toEqual({ '2026-10-13': 90_000, '2026-10-14': 10_000 });
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
