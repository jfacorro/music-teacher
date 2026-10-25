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

/** A note leans flat or sharp when it was off by at least this much on average, in cents. */
const LEAN_CENTS = 10;
/** A lean needs this share of the notes sung leaning the same way. */
const LEAN_SHARE = 0.6;
/** Fewer notes than this say nothing about a lean. */
const LEAN_MIN_NOTES = 3;
/** Further off than this (cents), a note wasn't aimed at: it says nothing about a lean. */
const LEAN_AIMED_CENTS = 100;

/** Which way most notes of a run leaned: how many of those sung, and by how much. */
export interface PitchLean {
  /** The leaning notes' average, in cents: negative flat, positive sharp. */
  cents: number;
  count: number;
  total: number;
}

/**
 * Whether most notes sung leaned the same way, flat or sharp, from each note's average offset
 * (cents, null when not sung); null when they didn't, or too few were sung to tell.
 */
export function pitchLean(offsets: readonly (number | null)[]): PitchLean | null {
  const sung = offsets.filter(
    (offset): offset is number => offset !== null && Math.abs(offset) <= LEAN_AIMED_CENTS,
  );
  if (sung.length < LEAN_MIN_NOTES) return null;
  for (const sign of [1, -1]) {
    const leaning = sung.filter((offset) => offset * sign >= LEAN_CENTS);
    if (leaning.length / sung.length >= LEAN_SHARE) {
      const cents = leaning.reduce((sum, offset) => sum + offset, 0) / leaning.length;
      return { cents: Math.round(cents), count: leaning.length, total: sung.length };
    }
  }
  return null;
}

/** Steady notes sung beyond the saved range so far: the lowest below it, the highest above. */
export interface Beyond {
  low: number | null;
  high: number | null;
}

/** The furthest steady notes beyond `range`, with `note` just held. */
export function furthestBeyond(
  beyond: Beyond,
  range: { low: number; high: number },
  note: number,
): Beyond {
  return {
    low: note < range.low ? Math.min(beyond.low ?? note, note) : beyond.low,
    high: note > range.high ? Math.max(beyond.high ?? note, note) : beyond.high,
  };
}
