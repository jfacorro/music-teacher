/**
 * Internal score model (PLAN.md §4). Positions and durations are in beats, where one beat is
 * a quarter note whatever the time signature (as in MusicXML), and `tempo` is quarter notes
 * per minute.
 */
import type { SongAnalysis } from './harmony';
import type { Pitch } from '../theory/pitch';
import type { ScoreDynamics } from './dynamics';
import type { Marking } from './markings';

export const Hand = {
  Left: 'L',
  Right: 'R',
} as const;
export type Hand = (typeof Hand)[keyof typeof Hand];

export type Finger = 1 | 2 | 3 | 4 | 5;

/** How a note is played (MusicXML `<articulations>`). */
export const Articulation = {
  /** Short: let go before half its length. */
  Staccato: 'staccato',
  /** Louder than the notes around it. */
  Accent: 'accent',
  /** Held its whole length. */
  Tenuto: 'tenuto',
} as const;
export type Articulation = (typeof Articulation)[keyof typeof Articulation];

export interface ScoreNote {
  pitch: Pitch;
  start: number;
  duration: number;
  hand: Hand;
  finger?: Finger;
  articulations?: Articulation[];
  /** The hand crosses over the other to play it: it's written on the other hand's staff. */
  crossed?: boolean;
  /** Held longer than written (a fermata): the music waits on it. */
  fermata?: boolean;
  /**
   * The syllable sung on it, by language (e.g. "en"); a note held from the syllable before (a
   * melisma) has none. Lyrics read from a file are under `LYRICS_AS_WRITTEN`.
   */
  lyrics?: Readonly<Record<string, Lyric>>;
}

/** Where a syllable stands in its word (MusicXML `<syllabic>`). */
export const Syllabic = {
  Single: 'single',
  Begin: 'begin',
  Middle: 'middle',
  End: 'end',
} as const;
export type Syllabic = (typeof Syllabic)[keyof typeof Syllabic];

/** A syllable of the words, sung on a note (MusicXML `<lyric>`). */
export interface Lyric {
  text: string;
  syllabic: Syllabic;
  /** Held over the next notes too (a melisma): a line is drawn after it. */
  extend?: boolean;
}

/** The language key of lyrics read from a file, whose language isn't known. */
export const LYRICS_AS_WRITTEN = 'und';

/** A song's words: the hand whose notes are sung, and the words as text, by language. */
export interface ScoreLyrics {
  hand: Hand;
  /** The words in lines, as they're read (no hyphens), by language. */
  lines: Readonly<Record<string, readonly string[]>>;
}

/** Notes played smoothly connected (legato): one hand's notes from `start` to `end` (beats). */
export interface Slur {
  start: number;
  end: number;
  hand: Hand;
}

const SAME_BEAT = 1e-6;

/** The notes a slur joins, in order. */
export function slurNotes(notes: readonly ScoreNote[], slur: Slur): ScoreNote[] {
  return notes
    .filter(
      (note) =>
        note.hand === slur.hand &&
        note.start >= slur.start - SAME_BEAT &&
        note.start <= slur.end + SAME_BEAT,
    )
    .sort((a, b) => a.start - b.start || a.pitch.midi - b.pitch.midi);
}

/**
 * The sustain pedal held from `down` to `up` (beats). A mark starting where the one before ends
 * is a pedal change: up as the new notes play, down again just after.
 */
export interface PedalMark {
  down: number;
  up: number;
}

export interface Measure {
  start: number;
  length: number;
}

/** A stretch of music played twice (beats, at bar lines): from `start` to the repeat sign at `end`. */
export interface Repeat {
  start: number;
  end: number;
  /**
   * First and second endings: the first (ending at the repeat sign) is played the first time
   * only; the second (starting there) is played instead the second time.
   */
  endings?: [Ending, Ending];
}

export interface Ending {
  start: number;
  end: number;
}

/** Gradually slower from `start` to `end` (rit.), back in tempo after (a tempo). */
export interface Ritardando {
  start: number;
  end: number;
}

/** A stretch of the written music (`from`–`to`, beats) as played, from beat `at`. */
export interface Segment {
  from: number;
  to: number;
  at: number;
}

/**
 * How music with repeats is written and played: the score as written (for sheet music), and the
 * written stretches in the order they're played. The played score has every note once per time
 * it's played; `copies` gives each written note's.
 */
export interface Form {
  written: Score;
  segments: Segment[];
  copies: ReadonlyMap<ScoreNote, readonly ScoreNote[]>;
}

export interface Score {
  tempo: number;
  timeSignature: [number, number];
  /** Sorted by start, then pitch. */
  notes: ScoreNote[];
  measures: Measure[];
  /** Italian tempo words and dynamics written at the start, e.g. "moderato", "mf". */
  markings?: Marking[];
  /** Key signature as in MusicXML `<fifths>` (negative = flats); C major when absent. */
  keyFifths?: number;
  /** Loud and soft: levels from a beat on, and crescendos and diminuendos. */
  dynamics?: ScoreDynamics;
  /** Phrases played legato. */
  slurs?: Slur[];
  /** Where the sustain pedal is held, in order, not overlapping. */
  pedal?: PedalMark[];
  /** Repeat signs and endings, in order (as written; the played score has them unrolled). */
  repeats?: Repeat[];
  /** Where the music slows down (rit.), in order. */
  ritardandos?: Ritardando[];
  /** A score with repeats, as played: how it's written (see `unroll`, engine/form.ts). */
  form?: Form;
  /** A song's words: their syllables are on the notes (`ScoreNote.lyrics`). */
  lyrics?: ScoreLyrics;
  /** A song's chords, cadences and sections, as written in its file (engine/harmony.ts). */
  analysis?: SongAnalysis;
}

/** The score marks where to use the sustain pedal. */
export function hasPedalMarks(score: Score): boolean {
  return (score.pedal ?? []).length > 0;
}

/** The score asks for a touch: staccato, accents, tenuto or slurs, among these notes. */
export function hasTouchMarks(score: Score, notes: readonly ScoreNote[] = score.notes): boolean {
  return (
    notes.some((note) => (note.articulations?.length ?? 0) > 0) ||
    (score.slurs ?? []).some((slur) => notes.some((note) => slurNotes([note], slur).length > 0))
  );
}

export function beatsPerMeasure([numerator, denominator]: [number, number]): number {
  return (numerator * 4) / denominator;
}

/**
 * The beat a bar is counted (and the metronome clicks) in, in quarter notes: a dotted quarter in
 * compound time (6/8, 9/8, 12/8: groups of three eighth notes), otherwise a quarter.
 */
export function countedBeat([numerator, denominator]: [number, number]): number {
  return denominator === 8 && numerator % 3 === 0 && numerator > 3 ? 1.5 : 1;
}

/** Whole measures from beat 0 until the end of the last note (at least one). */
export function wholeMeasures(
  notes: readonly ScoreNote[],
  timeSignature: [number, number],
): Measure[] {
  const length = beatsPerMeasure(timeSignature);
  const count = Math.max(1, Math.ceil(scoreEnd({ notes }) / length - 1e-9));
  return Array.from({ length: count }, (_, i) => ({ start: i * length, length }));
}

/** Beat where the last note ends. */
export function scoreEnd(score: { notes: readonly ScoreNote[] }): number {
  return score.notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
}

/** Notes sounding at `beat` (start inclusive, end exclusive). */
export function notesAt(notes: readonly ScoreNote[], beat: number): ScoreNote[] {
  return notes.filter((note) => note.start <= beat && beat < note.start + note.duration);
}

/** Notes overlapping the window [from, to). */
export function notesBetween(notes: readonly ScoreNote[], from: number, to: number): ScoreNote[] {
  return notes.filter((note) => note.start < to && note.start + note.duration > from);
}

export function beatsToMs(beats: number, tempo: number): number {
  return (beats * 60_000) / tempo;
}

export function msToBeats(ms: number, tempo: number): number {
  return (ms * tempo) / 60_000;
}

/** Index of the measure containing `beat` (the first or last one, outside the score). */
export function measureAt(measures: readonly Measure[], beat: number): number {
  const index = measures.findIndex((measure) => beat < measure.start + measure.length);
  return index < 0 ? measures.length - 1 : index;
}
