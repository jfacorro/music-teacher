/**
 * Ear training (PLAN.md milestone 4.4): the app plays something and the learner plays it back
 * on the keyboard: a single note (after middle C as a reference), two notes in a row (an
 * interval, the first one shown), a short melody (its first note shown), a major or minor
 * chord (its root shown; answered by playing it, or by choosing major or minor), a rhythm
 * (tapped back on any key, at the learner's own speed), or a scale going up from the key shown
 * (answered by choosing major or minor).
 *
 * Levels open as the course teaches the keys they use. A question counts when it's answered
 * without a wrong key, as quiz cards do.
 */
import { resolvePlayed } from '../engine/micAliases';
import { parseRhythm } from '../engine/rhythm';
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
  /** A bar of rhythm on one key, tapped back on any key. */
  Rhythms: 'rhythms',
  /** A major or minor scale going up, its key note shown: which is it? */
  Scales: 'scales',
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
  [EarLevel.Rhythms]: 'u13',
  [EarLevel.Scales]: 'u12',
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
  /** Rhythms: when each note comes, and how long it lasts (beats); `notes` has its key. */
  rhythm: readonly { start: number; duration: number }[] | null;
}

/** Questions in one exercise. */
export const QUESTIONS: Readonly<Record<EarLevel, number>> = {
  [EarLevel.Notes]: 10,
  [EarLevel.Intervals]: 10,
  [EarLevel.Melodies]: 6,
  [EarLevel.Chords]: 10,
  [EarLevel.Rhythms]: 8,
  [EarLevel.Scales]: 10,
};

/**
 * The keys notes, intervals and melodies use, in the octave from middle C, growing with the
 * course: the right hand's first position (Unit 1), up to the C above (Unit 3, reading the
 * treble clef), E♭ (Unit 6, with C minor), F♯ and B♭ (Unit 7, with G and F major), and
 * the rest of the black keys (Unit 8, sharps and flats).
 */
const KEYS_FROM: readonly (readonly [string, readonly number[]])[] = [
  ['u1', [60, 62, 64, 65, 67]],
  ['u3', [69, 71, 72]],
  ['u6', [63]],
  ['u7', [66, 70]],
  ['u8', [61, 68]],
];

/** Scales melodies move in: C major, and G and F major once their scales are taught. */
const SCALES_FROM: readonly (readonly [string, readonly number[]])[] = [
  ['u1', [60, 62, 64, 65, 67, 69, 71, 72]],
  ['u7', [60, 62, 64, 66, 67, 69, 71, 72]],
  ['u7', [60, 62, 64, 65, 67, 69, 70, 72]],
];

/** What the questions can use. */
export interface EarRange {
  /** For single notes and intervals, lowest first. */
  keys: readonly number[];
  /** Interval sizes asked, semitones. */
  intervals: readonly number[];
  /** Scales for melodies (as far as the course has reached). */
  scales: readonly (readonly number[])[];
}

/** Every key from middle C to the C above. */
const ALL_NOTES = Array.from({ length: 13 }, (_, i) => MIDDLE_C + i);
/** Up to a fifth, leaving out the tritone (hard to hear and to sing). */
const COURSE_INTERVALS = [1, 2, 3, 4, 5, 7];
/** Every interval up to an octave. */
const ALL_INTERVALS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * What questions use, from the units finished; with `allNotes`, single notes and intervals use
 * every key of the octave from middle C, and intervals up to an octave, whatever the course
 * has reached (melodies stay in the scales taught).
 */
export function earRange(finishedUnits: ReadonlySet<string>, allNotes = false): EarRange {
  const taught = KEYS_FROM.flatMap(([unit, added]) => (finishedUnits.has(unit) ? added : [])).sort(
    (a, b) => a - b,
  );
  const scales = SCALES_FROM.filter(([unit]) => finishedUnits.has(unit)).map(([, scale]) =>
    scale.filter((key) => taught.includes(key)),
  );
  return allNotes
    ? { keys: ALL_NOTES, intervals: ALL_INTERVALS, scales }
    : { keys: taught, intervals: COURSE_INTERVALS, scales };
}

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

/** Steps of the scales (semitones from the key note), and the scales of Units 7 and 12. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10, 12];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11, 12];
const SCALES: readonly (readonly [number, readonly number[], ChordKind])[] = [
  [60, MAJOR, ChordQuality.Major],
  [62, MAJOR, ChordQuality.Major],
  [58, MAJOR, ChordQuality.Major],
  [69, NATURAL_MINOR, ChordQuality.Minor],
  [69, HARMONIC_MINOR, ChordQuality.Minor],
  [64, NATURAL_MINOR, ChordQuality.Minor],
  [64, HARMONIC_MINOR, ChordQuality.Minor],
  [62, NATURAL_MINOR, ChordQuality.Minor],
  [62, HARMONIC_MINOR, ChordQuality.Minor],
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
  rhythm: null,
  ...extra,
});

/**
 * Bars of rhythm (see engine/rhythm.ts), easier first: quarters, eighths and dotted quarters;
 * then sixteenths and a dotted eighth with a sixteenth; then syncopation (Unit 13).
 */
const RHYTHMS: readonly (readonly string[])[] = [
  ['q q e e q', 'q e e q q', 'q. e q q', 'e e q q. e', 'q rq e e q'],
  ['q s s s s q q', 's s e q q q', 'e. s q e. s q', 'q e. s h'],
  ['e q e q q', 'e q e e q e', 'q e q e q', 's s e e q e q'],
];
/** Questions from each set of rhythms, in order. */
const RHYTHMS_ASKED = [3, 3, 2];
/** The key rhythms are played on: the C above middle C. */
const RHYTHM_KEY = 72;

/** A new exercise: the questions of a level, using the keys `range` allows. */
export function earQuestions(
  level: EarLevel,
  range: EarRange,
  random: Random = Math.random,
): EarQuestion[] {
  const count = QUESTIONS[level];
  switch (level) {
    case EarLevel.Notes:
      return dealEvenly(random, range.keys, count).map((note) =>
        question(level, [note], { reference: MIDDLE_C, given: null }),
      );
    case EarLevel.Intervals: {
      const pairs = range.keys.flatMap((low) =>
        range.keys
          .filter((high) => high > low && range.intervals.includes(high - low))
          .map((high) => [low, high]),
      );
      return dealEvenly(random, pairs, count, (a, b) => a[0] === b[0] && a[1] === b[1]).map(
        (pair) => question(level, pair),
      );
    }
    case EarLevel.Melodies:
      return MELODY_LENGTHS.slice(0, count).map((length) =>
        question(level, melody(random, pick(random, range.scales), length)),
      );
    case EarLevel.Chords:
      return dealEvenly(random, CHORDS, count).map(([notes, quality]) =>
        question(level, notes, { quality }),
      );
    case EarLevel.Scales:
      return dealEvenly(random, SCALES, count).map(([keyNote, steps, quality]) =>
        question(
          level,
          steps.map((step) => keyNote + step),
          { quality },
        ),
      );
    case EarLevel.Rhythms:
      return RHYTHMS.flatMap((set, i) => dealEvenly(random, set, RHYTHMS_ASKED[i]!))
        .slice(0, count)
        .map((pattern) => {
          const rhythm = parseRhythm(pattern, [4, 4]);
          return question(
            level,
            rhythm.map(() => RHYTHM_KEY),
            { given: null, rhythm },
          );
        });
  }
}

/** Along a scale: mostly steps, some thirds, no key twice in a row. */
export function melody(random: Random, scale: readonly number[], length: number): number[] {
  const indexes = [Math.floor(random() * scale.length)];
  while (indexes.length < length) {
    const last = indexes.at(-1)!;
    const moves = (
      [
        [1, 6],
        [-1, 6],
        [2, 3],
        [-2, 3],
      ] as const
    ).filter(([move]) => last + move >= 0 && last + move < scale.length);
    indexes.push(last + pickWeighted(random, moves));
  }
  return indexes.map((index) => scale[index]!);
}

/** Lengths of a question's sounds, ms. */
const REFERENCE_MS = 800;
const AFTER_REFERENCE_MS = 700;
const NOTE_MS = 700;
const MELODY_NOTE_MS = 500;
const SCALE_NOTE_MS = 380;
const CHORD_MS = 1600;
/** Rhythms are played at 90 beats a minute, each note a little shorter than written. */
const RHYTHM_BEAT_MS = 60_000 / 90;
const RHYTHM_NOTE_SHARE = 0.8;

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
  if (question.quality && question.level !== EarLevel.Scales) {
    notes.push(...question.notes.map((midi) => ({ midi, at, length: CHORD_MS })));
    return notes;
  }
  if (question.rhythm) {
    return question.rhythm.map(({ start, duration }) => ({
      midi: RHYTHM_KEY,
      at: at + start * RHYTHM_BEAT_MS,
      length: Math.min(duration, 1) * RHYTHM_BEAT_MS * RHYTHM_NOTE_SHARE,
    }));
  }
  const length =
    question.level === EarLevel.Scales
      ? SCALE_NOTE_MS
      : question.level === EarLevel.Melodies
        ? MELODY_NOTE_MS
        : NOTE_MS;
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

/** For a hint: the next key due (none for a chord or a rhythm). */
export const hintKey = (question: EarQuestion, played: number): number | null =>
  question.quality || question.rhythm ? null : (question.notes[played] ?? null);

/** A tap may be this far from where the rhythm puts it, in beats (at the learner's speed). */
export const RHYTHM_TOLERANCE = 0.2;
/** Tapped back slower or faster than this, it isn't the same rhythm (ms per beat). */
const SLOWEST_BEAT_MS = 2000;
const FASTEST_BEAT_MS = 250;

/**
 * A rhythm tapped back, one tap per note (`taps`, ms): right when each tap falls where the
 * rhythm puts it, at the speed it was tapped (its first and last taps set the speed).
 */
export function answerRhythm(question: EarQuestion, taps: readonly number[]): Answer {
  const onsets = question.rhythm?.map((note) => note.start) ?? [];
  if (taps.length !== onsets.length || onsets.length === 0) return Answer.Wrong;
  const span = onsets.at(-1)! - onsets[0]!;
  if (span <= 0) return Answer.Right;
  const beatMs = (taps.at(-1)! - taps[0]!) / span;
  if (beatMs < FASTEST_BEAT_MS || beatMs > SLOWEST_BEAT_MS) return Answer.Wrong;
  const fits = onsets.every((onset, i) => {
    const expected = taps[0]! + (onset - onsets[0]!) * beatMs;
    return Math.abs(taps[i]! - expected) / beatMs <= RHYTHM_TOLERANCE + 1e-9;
  });
  return fits ? Answer.Right : Answer.Wrong;
}
