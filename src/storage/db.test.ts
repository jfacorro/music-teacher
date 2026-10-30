import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { db } from './db';

describe('database upgrade', () => {
  it('carries the practice time of finished runs over into practice days', async () => {
    const at = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();
    // The database as it was before practice days.
    const old = new Dexie('music-teacher');
    old.version(1).stores({ settings: 'key' });
    old.version(2).stores({ results: 'key', practiceLog: '++id, at' });
    await old.table('practiceLog').bulkAdd([
      {
        at: at('2026-10-12', '09:00'),
        kind: 'lesson',
        refId: 'a',
        stars: 3,
        accuracy: 1,
        durationMs: 60_000,
      },
      {
        at: at('2026-10-12', '21:00'),
        kind: 'song',
        refId: 'b',
        stars: 1,
        accuracy: 0.7,
        durationMs: 30_000,
      },
      {
        at: at('2026-10-13', '10:00'),
        kind: 'lesson',
        refId: 'a',
        stars: 2,
        accuracy: 0.9,
        durationMs: 15_000,
      },
    ]);
    old.close();

    await db.open();
    expect(await db.practiceDays.toArray()).toEqual([
      { day: '2026-10-12', ms: 90_000 },
      { day: '2026-10-13', ms: 15_000 },
    ]);
    expect(await db.practiceLog.count()).toBe(3);
  });
});
