/**
 * Note-naming systems (PLAN.md §8.3). Independent from the UI language: the language only
 * picks the default. Names are built from the spelling (step + alter), never from the MIDI
 * number, so a written D♭ is always shown as D♭ / Re♭ / Des.
 */
import type { Alter, Pitch, Step } from '../theory/pitch';

export const NamingSystem = {
  English: 'english',
  German: 'german',
  Solfege: 'solfege',
} as const;
export type NamingSystem = (typeof NamingSystem)[keyof typeof NamingSystem];

export const NAMING_SYSTEMS: readonly NamingSystem[] = [
  NamingSystem.English,
  NamingSystem.German,
  NamingSystem.Solfege,
];

export interface NoteNameOptions {
  /** Append the octave number (scientific pitch notation, C4 = middle C). */
  octave?: boolean;
}

/** A spelled note; the MIDI number isn't needed for naming. */
export type Spelled = Pick<Pitch, 'step' | 'alter' | 'octave'>;

export const ACCIDENTAL_SYMBOLS: Record<Alter, string> = {
  [-2]: '𝄫',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '𝄪',
};

const SOLFEGE: Record<Step, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

const GERMAN_LANGUAGES = ['de', 'da', 'nb', 'nn', 'no', 'sv', 'fi', 'cs', 'sk', 'pl', 'hu', 'sl'];
const SOLFEGE_LANGUAGES = ['es', 'fr', 'it', 'pt', 'ro', 'ca', 'gl'];

export function defaultNamingSystem(language: string): NamingSystem {
  const base = language.toLowerCase().split('-')[0] ?? '';
  if (GERMAN_LANGUAGES.includes(base)) return NamingSystem.German;
  if (SOLFEGE_LANGUAGES.includes(base)) return NamingSystem.Solfege;
  return NamingSystem.English;
}

export function noteName(
  pitch: Spelled,
  system: NamingSystem,
  options: NoteNameOptions = {},
): string {
  const name = baseName(pitch.step, pitch.alter, system);
  return options.octave ? `${name}${pitch.octave}` : name;
}

function baseName(step: Step, alter: Alter, system: NamingSystem): string {
  switch (system) {
    case NamingSystem.English:
      return step + ACCIDENTAL_SYMBOLS[alter];
    case NamingSystem.Solfege:
      return SOLFEGE[step] + ACCIDENTAL_SYMBOLS[alter];
    case NamingSystem.German:
      return germanName(step, alter);
  }
}

/** German: H = B natural, B = B♭, sharps add "-is", flats add "-es" (with contractions). */
function germanName(step: Step, alter: Alter): string {
  const letter = step === 'B' ? 'H' : step;
  switch (alter) {
    case 0:
      return letter;
    case 1:
      return `${letter}is`;
    case 2:
      return `${letter}isis`;
    case -1:
      if (step === 'B') return 'B';
      if (step === 'E' || step === 'A') return `${step}s`;
      return `${letter}es`;
    case -2:
      if (step === 'B') return 'Heses';
      if (step === 'E') return 'Eses';
      if (step === 'A') return 'Asas';
      return `${letter}eses`;
  }
}
