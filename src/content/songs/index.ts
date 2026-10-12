/**
 * Songs available to practice. Public-domain melodies only (PLAN.md §7).
 * Titles and composers are translated in `locales/<lang>/songs.json` under the same id.
 */
import type { Score } from '../../engine/score';
import { parseInlineScore } from '../loaders/inlineScore';

const loaders = {
  'ode-to-joy': () => import('./ode-to-joy.json'),
  'when-the-saints': () => import('./when-the-saints.json'),
} satisfies Record<string, () => Promise<{ default: unknown }>>;

export type SongId = keyof typeof loaders;

export const SONG_IDS = Object.keys(loaders) as SongId[];

export function isSongId(id: string | undefined): id is SongId {
  return id !== undefined && Object.hasOwn(loaders, id);
}

/** Loads and validates a song; throws `ScoreError` with the location of any problem. */
export async function loadSong(id: SongId): Promise<Score> {
  const module = await loaders[id]();
  return parseInlineScore(module.default, `song "${id}"`);
}
