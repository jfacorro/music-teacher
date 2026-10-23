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
  answerRhythm,
  answerQuality,
  EAR_LEVELS,
  EAR_UNITS,
  EarLevel,
  earQuestions,
  earRange,
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

/** Units up to (and including) this one. */
const unitsUpTo = (unitId: string) =>
  new Set(UNITS.slice(0, UNITS.findIndex((unit) => unit.id === unitId) + 1).map((u) => u.id));
/** What the questions can use once the units up to this one are finished. */
const rangeUpTo = (unitId: string) => earRange(unitsUpTo(unitId));
const FIRST_POSITION = rangeUpTo('u1');
const EVERYTHING = rangeUpTo('u7');

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
    expect(openEarLevels(UNITS, doneUpTo('u6'))).toEqual([
      EarLevel.Notes,
      EarLevel.Intervals,
      EarLevel.Melodies,
      EarLevel.Chords,
    ]);
    expect(openEarLevels(UNITS, doneUpTo('u12'))).toEqual(
      EAR_LEVELS.filter((level) => level !== EarLevel.Rhythms),
    );
    expect(openEarLevels(UNITS, doneUpTo('u13'))).toEqual(EAR_LEVELS);
  });

  it.each(EAR_LEVELS)('only play keys the course has taught by then (%s)', (level) => {
    const from = UNITS.findIndex((unit) => unit.id === EAR_UNITS[level]);
    for (const unit of UNITS.slice(from)) {
      const taught = keysTaughtUpTo(unit.id);
      for (let seed = 1; seed <= 30; seed++) {
        for (const question of earQuestions(level, rangeUpTo(unit.id), seededRandom(seed))) {
          for (const midi of question.notes) {
            expect(taught, `${unit.id}: ${pitchFromMidi(midi).step}${midi}`).toContain(midi);
          }
        }
      }
    }
  });

  it('use every key of the octave from middle C, and intervals up to an octave, when asked', () => {
    const all = earRange(unitsUpTo('u1'), true);
    expect(all.keys).toEqual([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72]);
    expect(all.intervals).toContain(6);
    expect(all.intervals).toContain(12);
    // Melodies stay in the scales taught.
    expect(all.scales).toEqual(rangeUpTo('u1').scales);
    const sizes = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        earQuestions(EarLevel.Intervals, all, seededRandom(seed)),
      ).flatMap((questions) => questions.map((q) => q.notes[1]! - q.notes[0]!)),
    );
    expect(sizes.has(12)).toBe(true);
  });

  it('use more keys as the course goes on, black keys included', () => {
    expect(rangeUpTo('u1').keys).toEqual([60, 62, 64, 65, 67]);
    expect(rangeUpTo('u3').keys).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(rangeUpTo('u6').keys).toEqual([60, 62, 63, 64, 65, 67, 69, 71, 72]);
    expect(EVERYTHING.keys).toEqual([60, 62, 63, 64, 65, 66, 67, 69, 70, 71, 72]);
    expect(rangeUpTo('u8').keys).toHaveLength(13);
    expect(rangeUpTo('u1').scales).toEqual([[60, 62, 64, 65, 67]]);
    expect(EVERYTHING.scales).toHaveLength(3);
  });
});

describe('earQuestions', () => {
  it.each(EAR_LEVELS)('makes a full exercise (%s)', (level) => {
    const questions = earQuestions(level, EVERYTHING, seededRandom(1));
    expect(questions).toHaveLength(QUESTIONS[level]);
  });

  it('plays middle C before each single note, and shows nothing to start from', () => {
    for (const question of earQuestions(EarLevel.Notes, FIRST_POSITION, seededRandom(2))) {
      expect(question.reference).toBe(60);
      expect(question.given).toBeNull();
      expect(question.notes).toHaveLength(1);
    }
  });

  it('asks for intervals upward from the note shown, up to a fifth, never a tritone', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const question of earQuestions(EarLevel.Intervals, EVERYTHING, seededRandom(seed))) {
        const [low, high] = question.notes as [number, number];
        expect(question.given).toBe(low);
        expect(high).toBeGreaterThan(low);
        expect(high - low).toBeLessThanOrEqual(7);
        expect(high - low).not.toBe(6);
      }
    }
  });

  it('includes black keys once they are taught', () => {
    const black = new Set([63, 66, 70]);
    const heard = Array.from({ length: 20 }, (_, seed) =>
      earQuestions(EarLevel.Notes, EVERYTHING, seededRandom(seed)),
    ).flatMap((questions) => questions.flatMap((q) => q.notes));
    expect(heard.some((midi) => black.has(midi))).toBe(true);
  });

  it('grows melodies from three notes to five, moving along a scale by step or third', () => {
    const questions = earQuestions(EarLevel.Melodies, EVERYTHING, seededRandom(4));
    expect(questions.map((q) => q.notes.length)).toEqual([3, 3, 4, 4, 5, 5]);
    for (const question of questions) {
      // All in one of the scales taught.
      expect(
        EVERYTHING.scales.some((scale) => question.notes.every((n) => scale.includes(n))),
      ).toBe(true);
      question.notes.slice(1).forEach((midi, i) => {
        const step = Math.abs(midi - question.notes[i]!);
        expect(step).toBeGreaterThan(0);
        expect(step).toBeLessThanOrEqual(4);
      });
    }
  });

  it('mixes major and minor chords, showing the root', () => {
    const questions = earQuestions(EarLevel.Chords, EVERYTHING, seededRandom(5));
    const qualities = new Set(questions.map((q) => q.quality));
    expect(qualities).toEqual(new Set([ChordQuality.Major, ChordQuality.Minor]));
    for (const question of questions) expect(question.given).toBe(question.notes[0]);
  });
});

describe('scales', () => {
  it('play a major or minor scale going up from its key note, shown', () => {
    const questions = earQuestions(EarLevel.Scales, EVERYTHING, seededRandom(4));
    expect(questions).toHaveLength(QUESTIONS[EarLevel.Scales]);
    expect(new Set(questions.map((q) => q.quality))).toEqual(
      new Set([ChordQuality.Major, ChordQuality.Minor]),
    );
    for (const q of questions) {
      expect(q.notes).toHaveLength(8);
      expect(q.notes.at(-1)! - q.notes[0]!).toBe(12);
      expect(q.given).toBe(q.notes[0]);
      // A minor scale's third is a half step lower than a major one's.
      expect(q.notes[2]! - q.notes[0]!).toBe(q.quality === ChordQuality.Major ? 4 : 3);
    }
    const notes = promptNotes(questions[0]!);
    expect(notes.map((note) => note.at)).toEqual([...notes.keys()].map((i) => i * 380));
    expect(answerQuality(questions[0]!, questions[0]!.quality!)).toBe(Answer.Right);
  });
});

describe('rhythms', () => {
  const [question] = earQuestions(EarLevel.Rhythms, EVERYTHING, seededRandom(3));
  const onsets = question!.rhythm!.map((note) => note.start);
  /** Taps where the rhythm puts them, at `beatMs`, each moved by `off` beats. */
  const tapped = (beatMs: number, off: (i: number) => number = () => 0) =>
    onsets.map((onset, i) => 1000 + (onset + off(i)) * beatMs);

  it('asks for a bar of rhythm on one key, easier ones first', () => {
    const questions = earQuestions(EarLevel.Rhythms, EVERYTHING, seededRandom(3));
    expect(questions).toHaveLength(QUESTIONS[EarLevel.Rhythms]);
    for (const q of questions) {
      expect(new Set(q.notes)).toEqual(new Set([72]));
      expect(q.notes).toHaveLength(q.rhythm!.length);
      expect(q.given).toBeNull();
    }
    const sixteenths = questions.map((q) => q.rhythm!.some((note) => note.duration < 0.5));
    expect(sixteenths.slice(0, 3)).toEqual([false, false, false]);
  });

  it('plays the notes where the rhythm puts them', () => {
    const notes = promptNotes(question!);
    expect(notes.map((note) => Math.round(note.at))).toEqual(
      onsets.map((onset) => Math.round((onset * 60_000) / 90)),
    );
  });

  it('takes a rhythm tapped back at any reasonable speed', () => {
    expect(answerRhythm(question!, tapped(500))).toBe(Answer.Right);
    expect(answerRhythm(question!, tapped(900))).toBe(Answer.Right);
    expect(
      answerRhythm(
        question!,
        tapped(600, (i) => (i === 1 ? 0.15 : 0)),
      ),
    ).toBe(Answer.Right);
  });

  it('says when a tap is off, or the speed is out of reach', () => {
    expect(
      answerRhythm(
        question!,
        tapped(600, (i) => (i === 1 ? 0.3 : 0)),
      ),
    ).toBe(Answer.Wrong);
    expect(answerRhythm(question!, tapped(100))).toBe(Answer.Wrong);
    expect(answerRhythm(question!, tapped(600).slice(1))).toBe(Answer.Wrong);
  });
});

describe('prompts', () => {
  it('play the reference, then the notes one after another', () => {
    const [question] = earQuestions(EarLevel.Notes, FIRST_POSITION, seededRandom(6));
    const notes = promptNotes(question!);
    expect(notes[0]).toMatchObject({ midi: 60, at: 0 });
    expect(notes[1]!.at).toBeGreaterThan(notes[0]!.length);
    expect(promptLength(question!)).toBe(notes[1]!.at + notes[1]!.length);
  });

  it('play a chord’s keys together', () => {
    const [question] = earQuestions(EarLevel.Chords, EVERYTHING, seededRandom(7));
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
    rhythm: null,
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
