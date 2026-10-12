/**
 * Saved progress (PLAN.md §10, milestone 1.7): best stars and accuracy per lesson and song,
 * plus a log of finished runs for streaks and practice time. Kept in IndexedDB so it
 * survives browser restarts, and mirrored in a store for the UI.
 */
import { create } from 'zustand';
import { db, type PracticeLogRow, type ResultRow } from './db';

export type ResultKind = 'lesson' | 'song';

export interface Attempt {
  stars: number;
  accuracy: number;
  durationMs: number;
}

interface ProgressState {
  /** By key: "lesson:<id>" / "song:<id>". */
  results: Readonly<Record<string, ResultRow>>;
  log: readonly PracticeLogRow[];
}

export const useProgress = create<ProgressState>(() => ({ results: {}, log: [] }));

export const resultKey = (kind: ResultKind, id: string) => `${kind}:${id}`;

/** A new attempt merged into the best result so far. */
export function mergeResult(
  key: string,
  previous: ResultRow | undefined,
  attempt: Attempt,
  now: number,
): ResultRow {
  return {
    key,
    bestStars: Math.max(previous?.bestStars ?? 0, attempt.stars),
    bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, attempt.accuracy),
    attempts: (previous?.attempts ?? 0) + 1,
    completedAt: previous?.completedAt ?? (attempt.stars >= 1 ? now : null),
    lastPlayedAt: now,
  };
}

export async function loadProgress(): Promise<void> {
  try {
    const [results, log] = await Promise.all([db.results.toArray(), db.practiceLog.toArray()]);
    useProgress.setState({
      results: Object.fromEntries(results.map((row) => [row.key, row])),
      log,
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
  const entry: PracticeLogRow = { at: now, kind, refId: id, ...attempt };
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

/** Local calendar day, e.g. "2026-10-13". */
export function dayOf(time: number): string {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Days in a row with some practice, ending today (or yesterday, so the streak isn't lost
 * before today's practice).
 */
export function streakDays(log: readonly Pick<PracticeLogRow, 'at'>[], now = Date.now()): number {
  const days = new Set(log.map((entry) => dayOf(entry.at)));
  const dayMs = 24 * 60 * 60 * 1000;
  let cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0); // midday avoids daylight-saving edge cases
  if (!days.has(dayOf(cursor.getTime()))) cursor = new Date(cursor.getTime() - dayMs);
  let streak = 0;
  while (days.has(dayOf(cursor.getTime()))) {
    streak++;
    cursor = new Date(cursor.getTime() - dayMs);
  }
  return streak;
}

export function totalPracticeMinutes(log: readonly Pick<PracticeLogRow, 'durationMs'>[]): number {
  return log.reduce((sum, entry) => sum + entry.durationMs, 0) / 60_000;
}
