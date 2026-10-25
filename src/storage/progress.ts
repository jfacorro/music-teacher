/**
 * Saved progress (PLAN.md §10, milestones 1.7 and 2.4): best stars and accuracy per lesson and
 * song, a log of finished runs, and practice time per day (for streaks). Kept in IndexedDB so
 * it survives browser restarts, and mirrored in a store for the UI.
 */
import { create } from 'zustand';
import { Course, findLesson, type Skill } from '../content/courses';
import { nextReview, reviewOf } from '../content/review';
import type { LoopRange } from '../engine/session';
import { dayOf, db, type PracticeLogRow, type ResultRow } from './db';

export { dayOf };

export const ResultKind = {
  Lesson: 'lesson',
  Song: 'song',
  /** An imported song ("My songs"). */
  MySong: 'mySong',
  /** A sight-reading drill: saved by level (its id), each drill being new. */
  Drill: 'drill',
  /** An ear-training exercise: saved by level (its id). */
  Ear: 'ear',
  /** A singing exercise: saved by its id (Match the note, on the Tuner page). */
  Voice: 'voice',
  /** The voice's ear-training exercise: saved by level (its id). */
  VoiceEar: 'voiceEar',
  /** A sight-singing drill: saved by level (its id), each drill being new. */
  VoiceDrill: 'voiceDrill',
} as const;
export type ResultKind = (typeof ResultKind)[keyof typeof ResultKind];

export interface Attempt {
  stars: number;
  accuracy: number;
  durationMs: number;
  /** Songs: the bars of this run that need work (null: none); lessons leave it out. */
  weakBars?: LoopRange | null;
}

interface ProgressState {
  /** By key: "lesson:<id>" / "song:<id>" / "mySong:<id>". */
  results: Readonly<Record<string, ResultRow>>;
  log: readonly PracticeLogRow[];
  /** Practice time by local day ("2026-10-14"), ms. */
  days: Readonly<Record<string, number>>;
}

export const useProgress = create<ProgressState>(() => ({ results: {}, log: [], days: {} }));

export const resultKey = (kind: ResultKind, id: string) => `${kind}:${id}`;

/** The course a result belongs to: a lesson's own, the voice's exercises, the rest the piano's. */
export function courseOfResult(kind: ResultKind, id: string): Course {
  if (kind === ResultKind.Voice || kind === ResultKind.VoiceEar || kind === ResultKind.VoiceDrill)
    return Course.Voice;
  if (kind === ResultKind.Lesson) return findLesson(id)?.course ?? Course.Piano;
  return Course.Piano;
}

/** Skills practiced by exercises of their own, and the results that count for them. */
const EXERCISE_RESULTS: Partial<Readonly<Record<Skill, ResultKind>>> = {
  'sight-reading': ResultKind.Drill,
  'ear-training': ResultKind.Ear,
  'singing-by-ear': ResultKind.VoiceEar,
  'sight-singing': ResultKind.VoiceDrill,
};
/** How many of the latest exercises count for a skill's mastery. */
export const EXERCISE_RUNS = 10;

/** The accuracy of the latest exercises for each skill (none for skills taught by lessons). */
export function exerciseAccuracies(log: readonly PracticeLogRow[]): (skill: Skill) => number[] {
  return (skill) => {
    const kind = EXERCISE_RESULTS[skill];
    if (!kind) return [];
    return log
      .filter((entry) => entry.kind === kind)
      .slice(-EXERCISE_RUNS)
      .map((entry) => entry.accuracy);
  };
}

/** A new attempt merged into the best result so far, with its next review. */
export function mergeResult(
  key: string,
  previous: ResultRow | undefined,
  attempt: Attempt,
  now: number,
): ResultRow {
  const review = nextReview(previous ? reviewOf(previous) : null, attempt.stars, now);
  const weakBars = attempt.weakBars !== undefined ? attempt.weakBars : previous?.weakBars;
  return {
    key,
    bestStars: Math.max(previous?.bestStars ?? 0, attempt.stars),
    bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, attempt.accuracy),
    attempts: (previous?.attempts ?? 0) + 1,
    completedAt: previous?.completedAt ?? (attempt.stars >= 1 ? now : null),
    lastPlayedAt: now,
    ...(review && review),
    ...(weakBars !== undefined && { weakBars }),
  };
}

export async function loadProgress(): Promise<void> {
  try {
    const [results, log, days] = await Promise.all([
      db.results.toArray(),
      db.practiceLog.toArray(),
      db.practiceDays.toArray(),
    ]);
    useProgress.setState({
      results: Object.fromEntries(results.map((row) => [row.key, row])),
      log,
      days: Object.fromEntries(days.map((row) => [row.day, row.ms])),
    });
  } catch (error) {
    console.error('Could not load progress', error);
  }
}

/** Saves a finished lesson or song; returns the updated best result. */
export async function recordResult(
  kind: ResultKind,
  id: string,
  attempt: Attempt,
  now = Date.now(),
): Promise<ResultRow> {
  const key = resultKey(kind, id);
  const row = mergeResult(key, useProgress.getState().results[key], attempt, now);
  const { stars, accuracy, durationMs } = attempt;
  const entry: PracticeLogRow = { at: now, kind, refId: id, stars, accuracy, durationMs };
  useProgress.setState((state) => ({
    results: { ...state.results, [key]: row },
    log: [...state.log, entry],
  }));
  try {
    await db.transaction('rw', db.results, db.practiceLog, async () => {
      await db.results.put(row);
      await db.practiceLog.add(entry);
    });
  } catch (error) {
    console.error('Could not save progress', error);
  }
  return row;
}

/** Adds time spent playing to today's practice. */
export async function recordPracticeTime(ms: number, now = Date.now()): Promise<void> {
  if (!(ms > 0)) return;
  const day = dayOf(now);
  useProgress.setState((state) => ({
    days: { ...state.days, [day]: (state.days[day] ?? 0) + ms },
  }));
  try {
    await db.transaction('rw', db.practiceDays, async () => {
      const row = await db.practiceDays.get(day);
      await db.practiceDays.put({ day, ms: (row?.ms ?? 0) + ms });
    });
  } catch (error) {
    console.error('Could not save practice time', error);
  }
}

/** Gaps between key presses count up to this much: walking away isn't practice. */
export const IDLE_MS = 60_000;

/**
 * Measures practice time: from `start` to `stop`, counting each gap between moments of
 * activity (key presses) up to `IDLE_MS`.
 */
export function activityTimer(clock: () => number = () => performance.now()) {
  let last = clock();
  let total = 0;
  const count = () => {
    const now = clock();
    total += Math.min(Math.max(0, now - last), IDLE_MS);
    last = now;
  };
  return {
    activity: count,
    /** Total time, ms. */
    stop(): number {
      count();
      return total;
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midday of `time`'s day: stepping a day at a time from there avoids daylight-saving edges. */
const midday = (time: number) => new Date(time).setHours(12, 0, 0, 0);

/**
 * Days in a row with some practice, ending today (or yesterday, so the streak isn't lost
 * before today's practice).
 */
export function streakDays(practiced: Iterable<string>, now = Date.now()): number {
  const days = new Set(practiced);
  let cursor = midday(now);
  if (!days.has(dayOf(cursor))) cursor -= DAY_MS;
  let streak = 0;
  while (days.has(dayOf(cursor))) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}

/** The most days in a row ever practiced. */
export function longestStreak(practiced: Iterable<string>): number {
  const sorted = [...new Set(practiced)].sort();
  let longest = 0;
  let current = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    // The day after `previous`: its local midday plus a day.
    const next = previous && dayOf(new Date(`${previous}T12:00`).getTime() + DAY_MS);
    current = day === next ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = day;
  }
  return longest;
}

/** The days with some practice. */
export const practicedDays = (days: Readonly<Record<string, number>>): string[] =>
  Object.keys(days).filter((day) => (days[day] ?? 0) > 0);

export interface CalendarDay {
  day: string;
  date: Date;
  ms: number;
}

/**
 * The last `weeks` weeks for an activity calendar, oldest first, each starting on `firstDay`
 * (0 = Sunday … 6 = Saturday) and ending with this week; days after today are null.
 */
export function calendarWeeks(
  days: Readonly<Record<string, number>>,
  weeks: number,
  firstDay: number,
  now = Date.now(),
): (CalendarDay | null)[][] {
  const today = midday(now);
  const sinceWeekStart = (new Date(today).getDay() - firstDay + 7) % 7;
  const start = today - (sinceWeekStart + (weeks - 1) * 7) * DAY_MS;
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      // Midday plus whole days stays on the right date across daylight-saving changes.
      const time = start + (week * 7 + weekday) * DAY_MS;
      const day = dayOf(time);
      return day > dayOf(today) ? null : { day, date: new Date(time), ms: days[day] ?? 0 };
    }),
  );
}

/** Minutes of practice where each level of the activity calendar starts (1 to 4). */
export const ACTIVITY_LEVELS = [0, 5, 15, 30] as const;

/** 0 (none) to 4 (30 minutes or more), for coloring a day. */
export function activityLevel(ms: number): 0 | 1 | 2 | 3 | 4 {
  if (!(ms > 0)) return 0;
  return ACTIVITY_LEVELS.filter((minutes) => ms >= minutes * 60_000).length as 1 | 2 | 3 | 4;
}
