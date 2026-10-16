/**
 * Songs available to practice. Public-domain melodies only (PLAN.md §7).
 * Titles and composers are translated in `locales/<lang>/songs.json` under the same id.
 */
import type { Score } from '../../engine/score';
import { parseInlineScore } from '../loaders/inlineScore';

const loaders = {
  'ode-to-joy': () => import('./ode-to-joy.json'),
  'when-the-saints': () => import('./when-the-saints.json'),
  'lightly-row': () => import('./lightly-row.json'),
  'au-clair-de-la-lune': () => import('./au-clair-de-la-lune.json'),
  'hot-cross-buns': () => import('./hot-cross-buns.json'),
  'mary-had-a-little-lamb': () => import('./mary-had-a-little-lamb.json'),
  'jingle-bells': () => import('./jingle-bells.json'),
  'twinkle-twinkle': () => import('./twinkle-twinkle.json'),
  'brahms-lullaby': () => import('./brahms-lullaby.json'),
  'amazing-grace': () => import('./amazing-grace.json'),
  'minuet-in-g': () => import('./minuet-in-g.json'),
  greensleeves: () => import('./greensleeves.json'),
  'fur-elise': () => import('./fur-elise.json'),
} satisfies Record<string, () => Promise<{ default: unknown }>>;

export type SongId = keyof typeof loaders;

export const SONG_IDS = Object.keys(loaders) as SongId[];

/**
 * Each song's level: the unit whose lessons first use it. A song is suggested once its unit is
 * open (content/suggestions.ts); a test keeps this in step with the lessons.
 */
export const SONG_UNITS: Readonly<Record<SongId, string>> = {
  'ode-to-joy': 'u1',
  'when-the-saints': 'u2',
  'lightly-row': 'u3',
  'au-clair-de-la-lune': 'u3',
  'hot-cross-buns': 'u4',
  'mary-had-a-little-lamb': 'u4',
  'jingle-bells': 'u6',
  'twinkle-twinkle': 'u3',
  'brahms-lullaby': 'u5',
  'amazing-grace': 'u7',
  'minuet-in-g': 'u7',
  greensleeves: 'u8',
  'fur-elise': 'u8',
};

export function isSongId(id: string | undefined): id is SongId {
  return id !== undefined && Object.hasOwn(loaders, id);
}

/** Loads and validates a song; throws `ScoreError` with the location of any problem. */
export async function loadSong(id: SongId): Promise<Score> {
  const module = await loaders[id]();
  return parseInlineScore(module.default, `song "${id}"`);
}
