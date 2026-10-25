import type { ScoreNote } from '../../../engine/score';

/** Rows above the highest note and below the lowest. */
const ROWS_AROUND = 2;

/** The rows of semitones a melody is shown on: its notes and a couple more either side. */
export function laneRows(notes: readonly ScoreNote[]): { low: number; high: number } {
  const pitches = notes.map((note) => note.pitch.midi);
  return { low: Math.min(...pitches) - ROWS_AROUND, high: Math.max(...pitches) + ROWS_AROUND };
}
