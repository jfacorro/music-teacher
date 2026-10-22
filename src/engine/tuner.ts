/**
 * The voice tuner (the Tuner page): the note being sung and how far off, from the microphone's
 * pitch readings.
 */
import type { PitchReading } from '../input/mic/detector';

/** Readings averaged for what's shown (about a sixth of a second), so it doesn't jitter. */
export const AVERAGE_OF = 4;
/** Within this many cents of a note, it's in tune (as planned for singing exercises). */
export const IN_TUNE_CENTS = 25;
/** How far back the line of what was sung goes, ms. */
export const TRACE_MS = 5000;

/** A reading as an exact pitch, in semitones: the MIDI number plus its cents. */
export const exactPitch = (reading: PitchReading) => reading.midi + reading.cents / 100;

/** The note being sung and how far from it (cents), from the latest exact pitches. */
export function tunerNote(recent: readonly number[]): { midi: number; cents: number } | null {
  if (recent.length === 0) return null;
  const pitch = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const midi = Math.round(pitch);
  return { midi, cents: Math.round((pitch - midi) * 100) };
}

export const isInTune = (cents: number) => Math.abs(cents) <= IN_TUNE_CENTS;
