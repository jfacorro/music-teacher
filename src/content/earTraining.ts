/**
 * Ear training (PLAN.md milestone 4.4): the app plays something and the learner plays it back
 * on the keyboard: a single note (after middle C as a reference), two notes in a row (an
 * interval, the first one shown), a short melody (its first note shown), or a major or minor
 * chord (its root shown; answered by playing it, or by choosing major or minor).
 *
 * Levels open as the course teaches the keys they use. A question counts when it's answered
 * without a wrong key, as quiz cards do.
 */
import { resolvePlayed } from '../engine/micAliases';
import type { InputSource } from '../input/types';
import { dealEvenly, pick, pickWeighted, type Random } from '../lib/random';
import { ChordQuality } from '../theory/chords';
import { MIDDLE_C, pitchClass } from '../theory/pitch';
import type { Unit } from './courses';
import { isUnitFinished, type LessonState } from './unlock';

export const EarLevel = {
  /** One note, after hearing middle C. */
  Notes: 'notes',
  /** Two notes in a row, the first one shown. */
  Intervals: 'intervals',
  /** Three to five notes, the first one shown. */
  Melodies: 'melodies',
  /** A major or minor chord, its root shown. */
  Chords: 'chords',
} as const;
export type EarLevel = (typeof EarLevel)[keyof typeof EarLevel];

/** Easiest first. */
export const EAR_LEVELS: readonly EarLevel[] = Object.values(EarLevel);

/** Each level opens once this unit (which teaches the keys it uses) is finished. */
export const EAR_UNITS: Readonly<Record<EarLevel, string>> = {
  [EarLevel.Notes]: 'u1',
  [EarLevel.Intervals]: 'u1',
  [EarLevel.Melodies]: 'u2',
  [EarLevel.Chords]: 'u6',
};

/** The levels open now, easiest first. */
export function openEarLevels(
  units: readonly Unit[],
  states: ReadonlyMap<string, LessonState>,
): EarLevel[] {
  const finished = new Set(
    units.filter((unit) => isUnitFinished(unit, states)).map((unit) => unit.id),
  );
  return EAR_LEVELS.filter((level) => finished.has(EAR_UNITS[level]));
}

export type ChordKind = typeof ChordQuality.Major | typeof ChordQuality.Minor;

export interface EarQuestion {
  level: EarLevel;
  /** Played first so the learner knows where they are (middle C), or none. */
  reference: number | null;
  /** What's heard and played back: one after another, or together for a chord. */
  notes: readonly number[];
  /** Shown on the keyboard to start from (the first note, or a chord's root), or none. */
  given: number | null;
  /** Chords: major or minor. */
  quality: ChordKind | null;
}

/** Questions in one exercise. */
export const QUESTIONS: Readonly<Record<EarLevel, number>> = {
  [EarLevel.Notes]: 10,
  [EarLevel.Intervals]: 10,
  [EarLevel.Melodies]: 6,
  [EarLevel.Chords]: 10,
};

/** The right hand's first position, where notes, intervals and melodies are (Unit 1). */
const C_POSITION = [60, 62, 64, 65, 67];

/** Chords of Unit 6: the white-key major and minor chords from middle C up, and C minor. */
const CHORDS: readonly (readonly [readonly number[], ChordKind])[] = [
  [[60, 64, 67], ChordQuality.Major],
  [[62, 65, 69], ChordQuality.Minor],
  [[64, 67, 71], ChordQuality.Minor],
  [[65, 69, 72], ChordQuality.Major],
  [[67, 71, 74], ChordQuality.Major],
  [[69, 72, 76], ChordQuality.Minor],
  [[60, 63, 67], ChordQuality.Minor],
];

/** Melodies grow from three notes to five over an exercise. */
const MELODY_LENGTHS = [3, 3, 4, 4, 5, 5];

const question = (
  level: EarLevel,
  notes: readonly number[],
  extra: Partial<EarQuestion> = {},
): EarQuestion => ({
  level,
  reference: null,
  notes,
  given: notes[0] ?? null,
  quality: null,
  ...extra,
});

/** A new exercise: the questions of a level. */
export function earQuestions(level: EarLevel, random: Random = Math.random): EarQuestion[] {
  const count = QUESTIONS[level];
  switch (level) {
    case EarLevel.Notes:
      return dealEvenly(random, C_POSITION, count).map((note) =>
        question(level, [note], { reference: MIDDLE_C, given: null }),
      );
    case EarLevel.Intervals: {
      const pairs = C_POSITION.flatMap((low, i) =>
        C_POSITION.slice(i + 1).map((high) => [low, high]),
      );
      return dealEvenly(random, pairs, count, (a, b) => a[0] === b[0] && a[1] === b[1]).map(
        (pair) => question(level, pair),
      );
    }
    case EarLevel.Melodies:
      return MELODY_LENGTHS.slice(0, count).map((length) =>
        question(level, melody(random, length)),
      );
    case EarLevel.Chords:
      return dealEvenly(random, CHORDS, count).map(([notes, quality]) =>
        question(level, notes, { quality }),
      );
  }
}

/** Mostly steps, some thirds, no key twice in a row, within the position. */
function melody(random: Random, length: number): number[] {
  const indexes = [pick(random, [0, 1, 2, 3, 4])];
  while (indexes.length < length) {
    const last = indexes.at(-1)!;
    const moves = (
      [
        [1, 6],
        [-1, 6],
        [2, 3],
        [-2, 3],
      ] as const
    ).filter(([move]) => last + move >= 0 && last + move < C_POSITION.length);
    indexes.push(last + pickWeighted(random, moves));
  }
  return indexes.map((index) => C_POSITION[index]!);
}

/** Lengths of a question's sounds, ms. */
const REFERENCE_MS = 800;
const AFTER_REFERENCE_MS = 700;
const NOTE_MS = 700;
const MELODY_NOTE_MS = 500;
const CHORD_MS = 1600;

/** A key the app plays: from `at` for `length` (ms from the start of the question). */
export interface PromptNote {
  midi: number;
  at: number;
  length: number;
}

/** How a question sounds: the reference, then its notes (or chord). */
export function promptNotes(question: EarQuestion): PromptNote[] {
  const notes: PromptNote[] = [];
  let at = 0;
  if (question.reference !== null) {
    notes.push({ midi: question.reference, at, length: REFERENCE_MS });
    at += REFERENCE_MS + AFTER_REFERENCE_MS;
  }
  if (question.quality) {
    notes.push(...question.notes.map((midi) => ({ midi, at, length: CHORD_MS })));
    return notes;
  }
  const length = question.level === EarLevel.Melodies ? MELODY_NOTE_MS : NOTE_MS;
  for (const midi of question.notes) {
    notes.push({ midi, at, length });
    at += length;
  }
  return notes;
}

/** When the question has finished sounding, ms from its start. */
export const promptLength = (question: EarQuestion) =>
  Math.max(0, ...promptNotes(question).map((note) => note.at + note.length));

export const Answer = {
  /** Right so far: the next note is due. */
  Next: 'next',
  Right: 'right',
  Wrong: 'wrong',
} as const;
export type Answer = (typeof Answer)[keyof typeof Answer];

/**
 * A key played back for notes one after another: `played` of them are right so far. A
 * microphone note heard an octave off counts as the note expected.
 */
export function answerNote(
  question: EarQuestion,
  played: number,
  pitch: number,
  source: InputSource,
): Answer {
  const expected = question.notes[played];
  if (expected === undefined || resolvePlayed(pitch, source, [expected]) !== expected) {
    return Answer.Wrong;
  }
  return played + 1 === question.notes.length ? Answer.Right : Answer.Next;
}

/**
 * A chord played back: the keys held (any voicing or octave). Null until three different
 * notes are down.
 */
export function answerChord(question: EarQuestion, held: readonly number[]): Answer | null {
  const classes = new Set(held.map(pitchClass));
  if (classes.size < 3) return null;
  const wanted = new Set(question.notes.map(pitchClass));
  return classes.size === wanted.size && [...classes].every((pc) => wanted.has(pc))
    ? Answer.Right
    : Answer.Wrong;
}

/** Major or minor, chosen. */
export const answerQuality = (question: EarQuestion, quality: ChordKind): Answer =>
  quality === question.quality ? Answer.Right : Answer.Wrong;

/** For a hint: the next key due (none for a chord). */
export const hintKey = (question: EarQuestion, played: number): number | null =>
  question.quality ? null : (question.notes[played] ?? null);
