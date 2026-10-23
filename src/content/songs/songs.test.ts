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

describe('songs use what their unit has taught', () => {
  const lessonFiles = import.meta.glob<unknown>('../lessons/*.json', {
    eager: true,
    import: 'default',
  });

  /**
   * Black keys (pitch classes), time and key signatures, articulations, slurs and pedal marks, up
   * to a unit.
   */
  async function taughtUpTo(unitId: string) {
    const { UNITS } = await import('../courses');
    const { pitchClass, parseNote, isBlackKey } = await import('../../theory/pitch');
    const last = UNITS.findIndex((unit) => unit.id === unitId);
    const lessons = new Set(
      UNITS.slice(0, last + 1).flatMap((unit) => unit.lessons.map((lesson) => lesson.id)),
    );
    const black = new Set<number>();
    const times = new Set<string>(['4/4']);
    const keys = new Set<number>([0]);
    const articulations = new Set<string>();
    let slurs = false;
    let pedal = false;
    const addNote = (note: unknown) => {
      if (typeof note !== 'string') return;
      try {
        const midi = parseNote(note).midi;
        if (isBlackKey(midi)) black.add(pitchClass(midi));
      } catch {
        // Not a note (e.g. a translation key).
      }
    };
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (!value || typeof value !== 'object') return;
      const data = value as Record<string, unknown>;
      addNote(data.note);
      if (Array.isArray(data.notes)) data.notes.forEach(addNote);
      if (Array.isArray(data.timeSignature)) times.add(data.timeSignature.join('/'));
      if (typeof data.keyFifths === 'number') keys.add(data.keyFifths);
      if (Array.isArray(data.articulations)) {
        for (const mark of data.articulations) articulations.add(String(mark));
      }
      if (Array.isArray(data.slurs) && data.slurs.length > 0) slurs = true;
      if (Array.isArray(data.pedal) && data.pedal.length > 0) pedal = true;
      Object.values(data).forEach(walk);
    };
    for (const [path, lesson] of Object.entries(lessonFiles)) {
      if (lessons.has(path.slice('../lessons/'.length, -'.json'.length))) walk(lesson);
    }
    return { black, times, keys, articulations, slurs, pedal, pitchClass, isBlackKey };
  }

  it.each(SONG_IDS)('%s: black keys, time and key signature', async (id) => {
    const score = await loadSong(id);
    const { black, times, keys, pitchClass, isBlackKey } = await taughtUpTo(SONG_UNITS[id]);
    for (const note of score.notes) {
      if (isBlackKey(note.pitch.midi)) {
        expect(black, `${note.pitch.step}${note.pitch.alter} at ${note.start}`).toContain(
          pitchClass(note.pitch.midi),
        );
      }
    }
    expect(times).toContain(score.timeSignature.join('/'));
    expect(keys).toContain(score.keyFifths ?? 0);
  });

  it.each(SONG_IDS)('%s: articulations, slurs and the pedal', async (id) => {
    const score = await loadSong(id);
    const taught = await taughtUpTo(SONG_UNITS[id]);
    for (const note of score.notes) {
      for (const mark of note.articulations ?? []) {
        expect(taught.articulations, `${mark} at ${note.start}`).toContain(mark);
      }
    }
    if ((score.slurs ?? []).length > 0) expect(taught.slurs, 'slurs').toBe(true);
    if ((score.pedal ?? []).length > 0) expect(taught.pedal, 'pedal').toBe(true);
  });
});
