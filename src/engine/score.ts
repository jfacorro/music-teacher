/**
 * Internal score model (PLAN.md §4). Positions and durations are in beats, where one beat is
 * a quarter note whatever the time signature (as in MusicXML), and `tempo` is quarter notes
 * per minute.
 */
import type { Pitch } from '../theory/pitch';
import type { Marking } from './markings';

export type Hand = 'L' | 'R';
export type Finger = 1 | 2 | 3 | 4 | 5;

export interface ScoreNote {
  pitch: Pitch;
  start: number;
  duration: number;
  hand: Hand;
  finger?: Finger;
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
}

export function beatsPerMeasure([numerator, denominator]: [number, number]): number {
  return (numerator * 4) / denominator;
}

/** Beat where the last note ends. */
export function scoreEnd(score: Score): number {
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
