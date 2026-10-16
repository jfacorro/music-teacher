import { describe, expect, it } from 'vitest';
import { TRANSLATED_LANGUAGES } from '../../i18n/languages';
import { SONG_IDS, SONG_UNITS, isSongId, loadSong } from '.';

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

describe('song levels', () => {
  it('put each song in the unit whose lessons first use it', async () => {
    const { LESSON_ORDER, findLesson } = await import('../courses');
    const { loadLesson } = await import('../lessons');
    const { StepType } = await import('../lessons/lesson');
    const firstUnit = new Map<string, string>();
    for (const id of LESSON_ORDER) {
      const lesson = await loadLesson(id);
      for (const step of lesson.steps) {
        if (step.type === StepType.Exercise && step.song && !firstUnit.has(step.song)) {
          firstUnit.set(step.song, findLesson(id)!.unit.id);
        }
      }
    }
    for (const id of SONG_IDS) {
      expect(SONG_UNITS[id], id).toBe(firstUnit.get(id));
    }
  });
});
