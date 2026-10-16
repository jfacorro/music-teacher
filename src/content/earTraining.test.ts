import { describe, expect, it } from 'vitest';
import { InputSource } from '../input/types';
import { seededRandom } from '../lib/random';
import { ChordQuality } from '../theory/chords';
import { pitchFromMidi } from '../theory/pitch';
import { UNITS } from './courses';
import {
  Answer,
  answerChord,
  answerNote,
  answerQuality,
  EAR_LEVELS,
  EAR_UNITS,
  EarLevel,
  earQuestions,
  openEarLevels,
  promptLength,
  promptNotes,
  QUESTIONS,
} from './earTraining';
import { lessonStates } from './unlock';

const lessonFiles = import.meta.glob<unknown>('./lessons/*.json', {
  eager: true,
  import: 'default',
});

/** Keys the lessons up to (and including) a unit play or show, by MIDI number. */
function keysTaughtUpTo(unitId: string): Set<number> {
  const last = UNITS.findIndex((unit) => unit.id === unitId);
  const lessons = new Set(
    UNITS.slice(0, last + 1).flatMap((unit) => unit.lessons.map((l) => l.id)),
  );
  const keys = new Set<number>();
  const midiOf = (note: string) => {
    const m = /^([A-G])(#|b)?(\d)$/.exec(note);
    if (!m) return null;
    const step = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'];
    return step + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * (Number(m[3]) + 1);
  };
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const data = value as Record<string, unknown>;
    for (const note of [data.note, ...(Array.isArray(data.notes) ? data.notes : [])]) {
      const midi = typeof note === 'string' ? midiOf(note) : null;
      if (midi !== null) keys.add(midi);
    }
    Object.values(data).forEach(walk);
  };
  for (const [path, lesson] of Object.entries(lessonFiles)) {
    if (lessons.has(path.slice('./lessons/'.length, -'.json'.length))) walk(lesson);
  }
  return keys;
}

describe('ear training levels', () => {
  it('open with the units that teach their keys', () => {
    const doneUpTo = (unitId: string | null) => {
      const last = unitId ? UNITS.findIndex((unit) => unit.id === unitId) : -1;
      const done = new Set(
        UNITS.slice(0, last + 1).flatMap((unit) => unit.lessons.map((l) => l.id)),
      );
      return lessonStates(UNITS, (id) => (done.has(id) ? 1 : 0));
    };
    expect(openEarLevels(UNITS, doneUpTo(null))).toEqual([]);
    expect(openEarLevels(UNITS, doneUpTo('u1'))).toEqual([EarLevel.Notes, EarLevel.Intervals]);
    expect(openEarLevels(UNITS, doneUpTo('u2'))).toEqual([
      EarLevel.Notes,
      EarLevel.Intervals,
      EarLevel.Melodies,
    ]);
    expect(openEarLevels(UNITS, doneUpTo('u6'))).toEqual(EAR_LEVELS);
  });

  it.each(EAR_LEVELS)('only play keys the course has taught by then (%s)', (level) => {
    const taught = keysTaughtUpTo(EAR_UNITS[level]);
    for (let seed = 1; seed <= 50; seed++) {
      for (const question of earQuestions(level, seededRandom(seed))) {
        for (const midi of question.notes) {
          expect(taught, pitchFromMidi(midi).step + midi).toContain(midi);
        }
      }
    }
  });
});

describe('earQuestions', () => {
  it.each(EAR_LEVELS)('makes a full exercise (%s)', (level) => {
    const questions = earQuestions(level, seededRandom(1));
    expect(questions).toHaveLength(QUESTIONS[level]);
  });

  it('plays middle C before each single note, and shows nothing to start from', () => {
    for (const question of earQuestions(EarLevel.Notes, seededRandom(2))) {
      expect(question.reference).toBe(60);
      expect(question.given).toBeNull();
      expect(question.notes).toHaveLength(1);
    }
  });

  it('asks for intervals upward from the note shown, up to a fifth', () => {
    for (const question of earQuestions(EarLevel.Intervals, seededRandom(3))) {
      const [low, high] = question.notes as [number, number];
      expect(question.given).toBe(low);
      expect(high).toBeGreaterThan(low);
      expect(high - low).toBeLessThanOrEqual(7);
    }
  });

  it('grows melodies from three notes to five, moving by step or third', () => {
    const questions = earQuestions(EarLevel.Melodies, seededRandom(4));
    expect(questions.map((q) => q.notes.length)).toEqual([3, 3, 4, 4, 5, 5]);
    for (const question of questions) {
      question.notes.slice(1).forEach((midi, i) => {
        const step = Math.abs(midi - question.notes[i]!);
        expect(step).toBeGreaterThan(0);
        expect(step).toBeLessThanOrEqual(4);
      });
    }
  });

  it('mixes major and minor chords, showing the root', () => {
    const questions = earQuestions(EarLevel.Chords, seededRandom(5));
    const qualities = new Set(questions.map((q) => q.quality));
    expect(qualities).toEqual(new Set([ChordQuality.Major, ChordQuality.Minor]));
    for (const question of questions) expect(question.given).toBe(question.notes[0]);
  });
});

describe('prompts', () => {
  it('play the reference, then the notes one after another', () => {
    const [question] = earQuestions(EarLevel.Notes, seededRandom(6));
    const notes = promptNotes(question!);
    expect(notes[0]).toMatchObject({ midi: 60, at: 0 });
    expect(notes[1]!.at).toBeGreaterThan(notes[0]!.length);
    expect(promptLength(question!)).toBe(notes[1]!.at + notes[1]!.length);
  });

  it('play a chord’s keys together', () => {
    const [question] = earQuestions(EarLevel.Chords, seededRandom(7));
    expect(new Set(promptNotes(question!).map((note) => note.at)).size).toBe(1);
  });
});

describe('answers', () => {
  const melody = {
    level: EarLevel.Melodies,
    reference: null,
    notes: [64, 62, 60],
    given: 64,
    quality: null,
  };

  it('take the notes in order, and say when one is wrong', () => {
    expect(answerNote(melody, 0, 64, InputSource.Midi)).toBe(Answer.Next);
    expect(answerNote(melody, 1, 64, InputSource.Midi)).toBe(Answer.Wrong);
    expect(answerNote(melody, 1, 62, InputSource.Midi)).toBe(Answer.Next);
    expect(answerNote(melody, 2, 60, InputSource.Midi)).toBe(Answer.Right);
  });

  it('take a microphone note heard an octave off as the one expected', () => {
    expect(answerNote(melody, 2, 72, InputSource.Mic)).toBe(Answer.Right);
    expect(answerNote(melody, 2, 72, InputSource.Midi)).toBe(Answer.Wrong);
  });

  it('take a chord in any voicing once three notes are down, or its quality', () => {
    const chord = {
      ...melody,
      level: EarLevel.Chords,
      notes: [62, 65, 69],
      quality: ChordQuality.Minor,
    };
    expect(answerChord(chord, [62, 65])).toBeNull();
    expect(answerChord(chord, [65, 69, 74])).toBe(Answer.Right);
    expect(answerChord(chord, [62, 66, 69])).toBe(Answer.Wrong);
    expect(answerQuality(chord, ChordQuality.Minor)).toBe(Answer.Right);
    expect(answerQuality(chord, ChordQuality.Major)).toBe(Answer.Wrong);
  });
});
