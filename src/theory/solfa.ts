/**
 * Movable do (PLAN.md milestone 6.5): a note's place in the major key of its key signature, do
 * being the key note wherever it falls. A note outside the key keeps the syllable of its letter,
 * raised or lowered (fa♯ in C major). Shown only with letter note names, where it can't be taken
 * for a note's name (with solfège note names, do is C).
 */
import { keyAlterOf, keyStepOf } from './keys';
import { type Alter, type Pitch, STEPS } from './pitch';

/** do, re, mi, fa, sol, la, ti: the degrees of the major scale, from the key note. */
export const SOLFA_DEGREES = ['do', 're', 'mi', 'fa', 'sol', 'la', 'ti'] as const;
export type SolfaDegree = (typeof SOLFA_DEGREES)[number];

export interface Solfa {
  degree: SolfaDegree;
  /** Raised (1) or lowered (−1) from the key's own note on that letter. */
  alter: Alter;
}

/** The note's syllable in movable do, in the major key of `keyFifths`. */
export function solfaOf(pitch: Pick<Pitch, 'step' | 'alter'>, keyFifths = 0): Solfa {
  const from = STEPS.indexOf(keyStepOf(keyFifths));
  const degree = SOLFA_DEGREES[(STEPS.indexOf(pitch.step) - from + 7) % 7]!;
  return { degree, alter: (pitch.alter - keyAlterOf(pitch.step, keyFifths)) as Alter };
}
