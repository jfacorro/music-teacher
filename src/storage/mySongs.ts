/**
 * The learner's imported songs ("My songs", milestone 3.2), kept in IndexedDB. The list
 * (without the music) is mirrored in a store for the UI.
 */
import { create } from 'zustand';
import { db, type MySongRow } from './db';

export interface MySongSummary {
  id: number;
  title: string;
  composer: string | null;
  addedAt: number;
}

/** Newest first. */
export const useMySongs = create<{ songs: readonly MySongSummary[] }>(() => ({ songs: [] }));

export type NewSong = Omit<MySongRow, 'id' | 'addedAt'>;
export type SongChanges = Pick<MySongRow, 'title' | 'composer' | 'options'>;

const summaryOf = ({ id, title, composer, addedAt }: MySongRow & { id: number }) => ({
  id,
  title,
  composer,
  addedAt,
});

export async function loadMySongs(): Promise<void> {
  try {
    const rows = await db.mySongs.toArray();
    useMySongs.setState({
      songs: rows
        .filter((row): row is MySongRow & { id: number } => row.id !== undefined)
        .map(summaryOf)
        .sort((a, b) => b.addedAt - a.addedAt),
    });
  } catch (error) {
    console.error('Could not load my songs', error);
  }
}

/** Saves a newly imported song; returns its id. */
export async function addMySong(song: NewSong, now = Date.now()): Promise<number> {
  const row = { ...song, addedAt: now };
  const id = await db.mySongs.add(row);
  if (id === undefined) throw new Error('The new song got no id');
  useMySongs.setState((state) => ({ songs: [summaryOf({ ...row, id }), ...state.songs] }));
  return id;
}

export function getMySong(id: number): Promise<MySongRow | undefined> {
  return db.mySongs.get(id);
}

export async function updateMySong(id: number, changes: SongChanges): Promise<void> {
  await db.mySongs.update(id, changes);
  useMySongs.setState((state) => ({
    songs: state.songs.map((song) =>
      song.id === id ? { ...song, title: changes.title, composer: changes.composer } : song,
    ),
  }));
}

/** Removes the song; its results stay in the progress history. */
export async function deleteMySong(id: number): Promise<void> {
  await db.mySongs.delete(id);
  useMySongs.setState((state) => ({ songs: state.songs.filter((song) => song.id !== id) }));
}
