/**
 * Key signatures and their key notes (PLAN.md milestone 6.5): the major key's note for a
 * signature, how the signature alters a letter, and the key note nearest a melody, to play it
 * before reading the melody from the staff.
 */
import { type Alter, midiFor, STEPS, type Step } from './pitch';

/** Sharps and flats in the order key signatures add them. */
const SHARPS: readonly Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLATS: readonly Step[] = [...SHARPS].reverse();

/** The key note's letter for a key signature (its major key). */
export function keyStepOf(keyFifths: number): Step {
  return STEPS[(((keyFifths * 4) % 7) + 7) % 7]!;
}

/** How the key signature alters a letter. */
export function keyAlterOf(step: Step, keyFifths: number): Alter {
  if (keyFifths > 0) return SHARPS.slice(0, keyFifths).includes(step) ? 1 : 0;
  if (keyFifths < 0) return FLATS.slice(0, -keyFifths).includes(step) ? -1 : 0;
  return 0;
}

/** The key note nearest the middle of a melody's notes, the lower one when two are as near. */
export function keyNoteNear(keyFifths: number, midis: readonly number[]): number {
  const step = keyStepOf(keyFifths);
  const middle = (Math.min(...midis) + Math.max(...midis)) / 2;
  const octave = Math.floor(middle / 12) - 1;
  return [octave - 1, octave, octave + 1]
    .map((o) => midiFor(step, keyAlterOf(step, keyFifths), o))
    .reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a));
}
