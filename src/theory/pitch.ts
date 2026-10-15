export const Accidentals = {
  Sharps: 'sharps',
  Flats: 'flats',
} as const;
export type Accidentals = (typeof Accidentals)[keyof typeof Accidentals];

/**
 * Pitch representation (PLAN.md §4 "Pitch representation").
 *
 * - Authored content uses canonical note strings: "C4", "F#3", "Db4" (C4 = middle C = MIDI 60).
 *   Files are checked at run time (`parseNote`); notes written in code are `NoteString`s, which
 *   the compiler checks (`pitchOf`, `pitchesOf`).
 * - Code uses `Pitch`: the MIDI number (for matching, arithmetic, layout) plus the spelling
 *   (step, alter, octave) for sheet music and note names.
 * - Played notes are plain MIDI numbers; `pitchFromMidi` picks a default spelling for them.
 */

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
export type Alter = -2 | -1 | 0 | 1 | 2;
type AccidentalSign = '' | '#' | '##' | 'b' | 'bb';
type Octave = '-1' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

/** A canonical note string written in code ("C4", "F#3", "Bbb2"): a typo is a compile error. */
export type NoteString = `${Step}${AccidentalSign}${Octave}`;

export interface Pitch {
  readonly midi: number;
  readonly step: Step;
  readonly alter: Alter;
  readonly octave: number;
}

export interface SpellingContext {
  /** Explicit preference; wins over `keyFifths`. */
  accidentals?: Accidentals;
  /** Key signature as in MusicXML `<fifths>`: negative = flats, positive = sharps. */
  keyFifths?: number;
}

export const MIDDLE_C = 60;
export const PIANO_LOWEST = 21; // A0
export const PIANO_HIGHEST = 108; // C8

export const STEPS: readonly Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const ACCIDENTAL_TO_ALTER: Record<AccidentalSign, Alter> = {
  '': 0,
  '#': 1,
  '##': 2,
  b: -1,
  bb: -2,
};
const ALTER_TO_ACCIDENTAL: Record<Alter, AccidentalSign> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: '',
  1: '#',
  2: '##',
};

const NOTE_PATTERN = /^([A-G])(##|#|bb|b)?(-?\d)$/;

const SHARP_SPELLINGS: readonly (readonly [Step, Alter])[] = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
]; // prettier-ignore

const FLAT_SPELLINGS: readonly (readonly [Step, Alter])[] = [
  ['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
  ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
]; // prettier-ignore

export class InvalidNoteError extends Error {
  readonly input: string;

  constructor(input: string, reason: string) {
    super(`Invalid note "${input}": ${reason}`);
    this.name = 'InvalidNoteError';
    this.input = input;
  }
}

/** MIDI number for a spelled note. The octave belongs to the letter: B#3 = 60, Cb4 = 59. */
export function midiFor(step: Step, alter: Alter, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONES[step] + alter;
}

export function makePitch(step: Step, alter: Alter, octave: number): Pitch {
  const midi = midiFor(step, alter, octave);
  if (midi < 0 || midi > 127) {
    throw new RangeError(`${step}${ALTER_TO_ACCIDENTAL[alter]}${octave} is outside MIDI 0–127`);
  }
  return { midi, step, alter, octave };
}

/** Parses a canonical note string ("C4", "F#3", "Bbb2"). Throws `InvalidNoteError`. */
export function parseNote(input: string): Pitch {
  const match = NOTE_PATTERN.exec(input);
  if (!match) {
    throw new InvalidNoteError(
      input,
      'expected <step><accidental?><octave> with step A–G, accidental #, ##, b or bb (e.g. "C4", "F#3", "Bb2")',
    );
  }
  const step = match[1] as Step;
  const alter = ACCIDENTAL_TO_ALTER[(match[2] ?? '') as AccidentalSign];
  const octave = Number(match[3]);
  const midi = midiFor(step, alter, octave);
  if (midi < 0 || midi > 127) {
    throw new InvalidNoteError(input, 'outside the MIDI range 0–127');
  }
  return { midi, step, alter, octave };
}

/** The pitch of a note written in code. */
export function pitchOf(note: NoteString): Pitch {
  return parseNote(note);
}

/** The pitches of notes written in code. */
export function pitchesOf(...notes: NoteString[]): Pitch[] {
  return notes.map(pitchOf);
}

/** Canonical note string for files and debugging. Never shown to the user (see i18n/naming). */
export function formatNote(pitch: Pitch): string {
  return `${pitch.step}${ALTER_TO_ACCIDENTAL[pitch.alter]}${pitch.octave}`;
}

/** Default spelling for a MIDI number: sharps, or flats when the context asks for them. */
export function pitchFromMidi(midi: number, context: SpellingContext = {}): Pitch {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError(`MIDI note ${midi} is outside 0–127`);
  }
  const useFlats = context.accidentals
    ? context.accidentals === Accidentals.Flats
    : (context.keyFifths ?? 0) < 0;
  const [step, alter] = (useFlats ? FLAT_SPELLINGS : SHARP_SPELLINGS)[pitchClass(midi)]!;
  // Default spellings never cross an octave boundary (no B# or Cb), so the octave is direct.
  return { midi, step, alter, octave: Math.floor(midi / 12) - 1 };
}

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(pitchClass(midi));
}
