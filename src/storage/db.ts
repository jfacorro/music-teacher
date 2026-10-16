import Dexie, { type EntityTable } from 'dexie';
import type { ImportedMusic } from '../content/loaders/importedMusic';
import type { ImportOptions } from '../content/loaders/importedScore';
import type { Recording } from '../engine/recording';
import type { LoopRange } from '../engine/session';
import type { ResultKind } from './progress';

interface KeyValueRow {
  key: string;
  value: unknown;
}

/** Best result so far for a lesson or song; `key` is "lesson:<id>", "song:<id>" or "mySong:<id>". */
export interface ResultRow {
  key: string;
  bestStars: number;
  bestAccuracy: number;
  attempts: number;
  /** First time it was finished with at least one star (ms since epoch). */
  completedAt: number | null;
  lastPlayedAt: number;
  /** Spaced review (content/review.ts); absent on results saved before reviews existed. */
  reviewDays?: number;
  reviewDue?: number;
  /** Songs: the bars of the latest run that need work (engine/weakSpots.ts), if any. */
  weakBars?: LoopRange | null;
}

/** One finished lesson or song, for streaks and practice time. */
export interface PracticeLogRow {
  id?: number;
  /** ms since epoch */
  at: number;
  kind: ResultKind;
  refId: string;
  stars: number;
  accuracy: number;
  durationMs: number;
}

/** Time spent playing on one local day ("2026-10-14"), loops and unfinished runs included. */
export interface PracticeDayRow {
  day: string;
  ms: number;
}

/** A song the learner imported ("My songs"), with their choices for practicing it. */
export interface MySongRow {
  id?: number;
  /** User content: kept as written, never translated. */
  title: string;
  composer: string | null;
  fileName: string;
  /** ms since epoch */
  addedAt: number;
  music: ImportedMusic;
  options: ImportOptions;
}

/** The latest finished run of a song or lesson exercise, to listen to and compare. */
export interface RecordingRow {
  /** "song:<id>", "mySong:<id>", "lesson:<id>:<step>" or "drill:<level>:<seed>". */
  key: string;
  /** ms since epoch */
  recordedAt: number;
  recording: Recording;
}

export const db = new Dexie('piano-teacher') as Dexie & {
  settings: EntityTable<KeyValueRow, 'key'>;
  results: EntityTable<ResultRow, 'key'>;
  practiceLog: EntityTable<PracticeLogRow, 'id'>;
  practiceDays: EntityTable<PracticeDayRow, 'day'>;
  mySongs: EntityTable<MySongRow, 'id'>;
  recordings: EntityTable<RecordingRow, 'key'>;
};

db.version(1).stores({
  settings: 'key',
});

db.version(2).stores({
  results: 'key',
  practiceLog: '++id, at',
});

// Practice time used to come from finished runs only: carry it over, day by day.
db.version(3)
  .stores({ practiceDays: 'day' })
  .upgrade(async (tx) => {
    const days = new Map<string, number>();
    await tx
      .table<PracticeLogRow>('practiceLog')
      .each((entry) =>
        days.set(dayOf(entry.at), (days.get(dayOf(entry.at)) ?? 0) + entry.durationMs),
      );
    await tx
      .table<PracticeDayRow>('practiceDays')
      .bulkPut([...days].map(([day, ms]) => ({ day, ms })));
  });

db.version(4).stores({
  mySongs: '++id',
});

db.version(5).stores({
  recordings: 'key',
});

/** Local calendar day, e.g. "2026-10-13". */
export function dayOf(time: number): string {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
