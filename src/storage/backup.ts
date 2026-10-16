/**
 * Everything the app keeps (settings, results, practice history, imported songs) as one file,
 * to keep a copy or to move between the browser and the desktop app, which store their data
 * separately (PLAN.md milestone 3.5).
 */
import { db } from './db';

export const BACKUP_FORMAT = 'piano-teacher-backup';
export const BACKUP_VERSION = 1;

const TABLES = ['settings', 'results', 'practiceLog', 'practiceDays', 'mySongs'] as const;
type TableName = (typeof TABLES)[number];

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  /** ISO date and time. */
  exportedAt: string;
  tables: Record<TableName, unknown[]>;
}

export class BackupError extends Error {}

export async function exportBackup(now = new Date()): Promise<Backup> {
  const rows = await Promise.all(TABLES.map((name) => db.table(name).toArray()));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    tables: Object.fromEntries(TABLES.map((name, i) => [name, rows[i]])) as Backup['tables'],
  };
}

/** A file name for the backup, e.g. "piano-teacher-2026-10-16.json". */
export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `piano-teacher-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Checks a parsed file; throws `BackupError` if it isn't a backup this app can read. */
export function parseBackup(input: unknown): Backup {
  const data = input as Partial<Backup> | null;
  if (data === null || typeof data !== 'object' || data.format !== BACKUP_FORMAT) {
    throw new BackupError('not a Piano Teacher backup');
  }
  if (data.version !== BACKUP_VERSION) throw new BackupError(`version ${String(data.version)}`);
  const tables = data.tables as Partial<Backup['tables']> | undefined;
  if (!tables || !TABLES.every((name) => Array.isArray(tables[name]))) {
    throw new BackupError('missing tables');
  }
  return data as Backup;
}

/** Replaces everything the app keeps with the backup's contents (reload afterwards). */
export async function importBackup(backup: Backup): Promise<void> {
  await db.transaction(
    'rw',
    TABLES.map((name) => db.table(name)),
    async () => {
      for (const name of TABLES) {
        const table = db.table(name);
        await table.clear();
        await table.bulkAdd(backup.tables[name]);
      }
    },
  );
}
