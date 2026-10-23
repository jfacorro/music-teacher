/**
 * Internal score model (PLAN.md §4). Positions and durations are in beats, where one beat is
 * a quarter note whatever the time signature (as in MusicXML), and `tempo` is quarter notes
 * per minute.
 */
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
