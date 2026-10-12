import Dexie, { type EntityTable } from 'dexie';

interface KeyValueRow {
  key: string;
  value: unknown;
}

/** Best result so far for a lesson or song; `key` is "lesson:<id>" or "song:<id>". */
export interface ResultRow {
  key: string;
  bestStars: number;
  bestAccuracy: number;
  attempts: number;
  /** First time it was finished with at least one star (ms since epoch). */
  completedAt: number | null;
  lastPlayedAt: number;
}

/** One finished lesson or song, for streaks and practice time. */
export interface PracticeLogRow {
  id?: number;
  /** ms since epoch */
  at: number;
  kind: 'lesson' | 'song';
  refId: string;
  stars: number;
  accuracy: number;
  durationMs: number;
}

export const db = new Dexie('piano-teacher') as Dexie & {
  settings: EntityTable<KeyValueRow, 'key'>;
  results: EntityTable<ResultRow, 'key'>;
  practiceLog: EntityTable<PracticeLogRow, 'id'>;
};

db.version(1).stores({
  settings: 'key',
});

db.version(2).stores({
  results: 'key',
  practiceLog: '++id, at',
});
