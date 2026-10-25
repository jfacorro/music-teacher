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
  'aura-lee': () => import('./aura-lee.json'),
  'can-can': () => import('./can-can.json'),
  'gymnopedie-1': () => import('./gymnopedie-1.json'),
  'prelude-in-c': () => import('./prelude-in-c.json'),
  'musette-in-d': () => import('./musette-in-d.json'),
  'scarborough-fair': () => import('./scarborough-fair.json'),
  'morning-mood': () => import('./morning-mood.json'),
  'the-entertainer': () => import('./the-entertainer.json'),
  'minuet-in-g-as-written': () => import('./minuet-in-g-as-written.json'),
  'minuet-in-g-minor': () => import('./minuet-in-g-minor.json'),
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
  'aura-lee': 'u9',
  'can-can': 'u9',
  'gymnopedie-1': 'u10',
  'prelude-in-c': 'u11',
  'musette-in-d': 'u12',
  'scarborough-fair': 'u12',
  'morning-mood': 'u13',
  'the-entertainer': 'u13',
  'minuet-in-g-as-written': 'u14',
  'minuet-in-g-minor': 'u14',
};

/**
 * The songs with words, sung in the voice's Song practice (PLAN.md milestone 6.6), easiest
 * first. A test checks that these, and only these, have words in English and Spanish.
 */
export const VOICE_SONG_IDS: readonly SongId[] = [
  'hot-cross-buns',
  'mary-had-a-little-lamb',
  'twinkle-twinkle',
  'au-clair-de-la-lune',
  'when-the-saints',
  'lightly-row',
  'ode-to-joy',
  'jingle-bells',
  'amazing-grace',
];

/** The voice unit that starts singing songs with their words: Today suggests them from then. */
export const VOICE_SONGS_UNIT = 'v8';

export function isSongId(id: string | undefined): id is SongId {
  return id !== undefined && Object.hasOwn(loaders, id);
}

/** Loads and validates a song; throws `ScoreError` with the location of any problem. */
export async function loadSong(id: SongId): Promise<Score> {
  const module = await loaders[id]();
  return parseInlineScore(module.default, `song "${id}"`);
}
