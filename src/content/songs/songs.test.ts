import { describe, expect, it } from 'vitest';
import { TRANSLATED_LANGUAGES } from '../../i18n/languages';
import { SONG_IDS, isSongId, loadSong } from '.';

const titles = import.meta.glob<Record<string, { title?: string }>>('/locales/*/songs.json', {
  eager: true,
  import: 'default',
});

describe('songs', () => {
  // Every song file is parsed here, so a typo in a note fails the test run.
  it.each(SONG_IDS)('%s loads and validates', async (id) => {
    const score = await loadSong(id);
    expect(score.notes.length).toBeGreaterThan(0);
  });

  it.each(TRANSLATED_LANGUAGES)('every song has a title in %s', (language) => {
    const songs = titles[`/locales/${language}/songs.json`] ?? {};
    for (const id of SONG_IDS) expect(songs[id]?.title, id).toBeTruthy();
  });

  it('recognises song ids', () => {
    expect(isSongId('ode-to-joy')).toBe(true);
    expect(isSongId('nope')).toBe(false);
    expect(isSongId('toString')).toBe(false);
    expect(isSongId(undefined)).toBe(false);
  });
});
