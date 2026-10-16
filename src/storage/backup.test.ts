import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { backupFileName, BackupError, exportBackup, importBackup, parseBackup } from './backup';
import { db } from './db';

describe('backups', () => {
  it('saves everything and puts it back, replacing what was there', async () => {
    await db.settings.put({ key: 'app', value: { language: 'es' } });
    await db.results.put({
      key: 'lesson:u1-l1',
      bestStars: 3,
      bestAccuracy: 1,
      attempts: 2,
      completedAt: 1,
      lastPlayedAt: 2,
    });
    await db.practiceDays.put({ day: '2026-10-16', ms: 60_000 });
    const backup = parseBackup(
      JSON.parse(JSON.stringify(await exportBackup(new Date('2026-10-16T10:00:00Z')))),
    );
    expect(backup.exportedAt).toBe('2026-10-16T10:00:00.000Z');
    expect(backup.tables.results).toHaveLength(1);

    await db.results.put({
      key: 'lesson:other',
      bestStars: 1,
      bestAccuracy: 0.6,
      attempts: 1,
      completedAt: 1,
      lastPlayedAt: 1,
    });
    await db.settings.put({ key: 'app', value: { language: 'en' } });
    await importBackup(backup);

    expect((await db.results.toArray()).map((row) => row.key)).toEqual(['lesson:u1-l1']);
    expect((await db.settings.get('app'))?.value).toEqual({ language: 'es' });
    expect(await db.practiceDays.get('2026-10-16')).toEqual({ day: '2026-10-16', ms: 60_000 });
  });

  it('rejects files that aren’t backups', () => {
    expect(() => parseBackup({ some: 'json' })).toThrow(BackupError);
    expect(() => parseBackup(null)).toThrow(BackupError);
    expect(() => parseBackup({ format: 'piano-teacher-backup', version: 99, tables: {} })).toThrow(
      'version 99',
    );
    expect(() => parseBackup({ format: 'piano-teacher-backup', version: 1, tables: {} })).toThrow(
      'missing tables',
    );
  });

  it('names the file after the day', () => {
    expect(backupFileName(new Date(2026, 9, 16))).toBe('piano-teacher-2026-10-16.json');
  });
});
