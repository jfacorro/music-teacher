/**
 * Key signatures and their key notes (PLAN.md milestone 6.5): the major key's note for a
 * signature, how the signature alters a letter, and the key note nearest a melody, to play it
 * before reading the melody from the staff. Also a key's signature and its scale, spelled from
 * the signature, for theory questions (milestone 7.3).
 */
import { type Alter, makePitch, midiFor, type Pitch, STEPS, type Step } from './pitch';

export const Mode = {
  Major: 'major',
  Minor: 'minor',
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

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

/** The most sharps or flats in a key signature. */
const MOST_FIFTHS = 7;
/** How many letters up from a major key's note to its relative minor's. */
const TO_RELATIVE_MINOR = 5;

function keyNote(keyFifths: number, mode: Mode): { step: Step; alter: Alter } {
  const major = STEPS.indexOf(keyStepOf(keyFifths));
  const step = STEPS[(major + (mode === Mode.Minor ? TO_RELATIVE_MINOR : 0)) % STEPS.length]!;
  return { step, alter: keyAlterOf(step, keyFifths) };
}

/**
 * The key signature of the key on `tonic`.
 * @throws RangeError when no signature has that key (G♯ major would need a double sharp)
 */
export function keyFifthsOf(tonic: Pitch, mode: Mode): number {
  for (let fifths = -MOST_FIFTHS; fifths <= MOST_FIFTHS; fifths++) {
    const { step, alter } = keyNote(fifths, mode);
    if (step === tonic.step && alter === tonic.alter) return fifths;
  }
  throw new RangeError(`No key signature for ${tonic.step}${tonic.alter} ${mode}`);
}

/** The eight notes of a key's scale, up from `tonic`; the minor one is the natural minor. */
export function scaleNotes(tonic: Pitch, mode: Mode): Pitch[] {
  const fifths = keyFifthsOf(tonic, mode);
  return Array.from({ length: STEPS.length + 1 }, (_, i) => {
    const index = STEPS.indexOf(tonic.step) + i;
    const step = STEPS[index % STEPS.length]!;
    const octave = tonic.octave + Math.floor(index / STEPS.length);
    return makePitch(step, keyAlterOf(step, fifths), octave);
  });
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
