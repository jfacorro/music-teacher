import Dexie, { type EntityTable } from 'dexie';

interface KeyValueRow {
  key: string;
  value: unknown;
}

export const db = new Dexie('piano-teacher') as Dexie & {
  settings: EntityTable<KeyValueRow, 'key'>;
};

db.version(1).stores({
  settings: 'key',
});
