/**
 * Movable do (PLAN.md milestone 6.5): a note's place in the major key of its key signature, do
 * being the key note wherever it falls, as the voice course teaches it. A note outside the key
 * keeps the syllable of its letter, raised or lowered (fa♯ in C major).
 */
import { type Alter, midiFor, type Pitch, STEPS, type Step } from './pitch';

/** do, re, mi, fa, sol, la, ti: the degrees of the major scale, from the key note. */
export const SOLFA_DEGREES = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'] as const;
export type SolfaDegree = (typeof SOLFA_DEGREES)[number];

export interface Solfa {
  degree: SolfaDegree;
  /** Raised (1) or lowered (−1) from the key's own note on that letter. */
  alter: Alter;
}

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

/** The note's syllable in movable do, in the major key of `keyFifths`. */
export function solfaOf(pitch: Pick<Pitch, 'step' | 'alter'>, keyFifths = 0): Solfa {
  const from = STEPS.indexOf(keyStepOf(keyFifths));
  const degree = SOLFA_DEGREES[(STEPS.indexOf(pitch.step) - from + 7) % 7]!;
  return { degree, alter: (pitch.alter - keyAlterOf(pitch.step, keyFifths)) as Alter };
}

/** The key note (do) nearest the middle of a melody's notes, the lower one when two are as near. */
export function keyNoteNear(keyFifths: number, midis: readonly number[]): number {
  const step = keyStepOf(keyFifths);
  const middle = (Math.min(...midis) + Math.max(...midis)) / 2;
  const octave = Math.floor(middle / 12) - 1;
  return [octave - 1, octave, octave + 1]
    .map((o) => midiFor(step, keyAlterOf(step, keyFifths), o))
    .reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a));
}
