/**
 * A song's harmony (PLAN.md milestone 7.4), written by hand in its file: its chords by their
 * numerals in the key, where its phrases end (cadences), and its sections. It's written rather
 * than worked out, because a melody's passing notes and broken chords fool `identifyChord`, and a
 * lesson mustn't teach a wrong answer; a test checks each chord against the song's notes.
 *
 * The numerals are kept, not the chords' names, so a song moved to another key (for a singer's
 * range) keeps its numerals and its chord names move with it.
 */
import { ChordQuality } from '../theory/chords';
import { keyTonic, Mode } from '../theory/keys';
import type { Pitch } from '../theory/pitch';
import { type Cadence, Numeral, numeralChord } from './theoryQuestions';

export interface SongChord {
  /** The beat it starts on; it lasts until the next chord. */
  start: number;
  numeral: Numeral;
}

export interface SongCadence {
  /** The bar the phrase ends in, from 0. */
  measure: number;
  kind: Cadence;
}

export interface SongSection {
  /** The bar it starts in, from 0. */
  measure: number;
  /** A letter, as in "A", "A′", "B". */
  name: string;
}

export interface SongAnalysis {
  /** In order, never the same numeral twice in a row. */
  chords: SongChord[];
  cadences: SongCadence[];
  /** In order, the first one at the first bar. */
  sections: SongSection[];
}

/** The kinds of chord the numerals name, which have short names ("Dm", "G7"). */
export type NumeralQuality =
  | typeof ChordQuality.Major
  | typeof ChordQuality.Minor
  | typeof ChordQuality.Diminished
  | typeof ChordQuality.Dominant7;

const QUALITIES: Readonly<Record<Numeral, NumeralQuality>> = {
  [Numeral.One]: ChordQuality.Major,
  [Numeral.Two]: ChordQuality.Minor,
  [Numeral.Three]: ChordQuality.Minor,
  [Numeral.Four]: ChordQuality.Major,
  [Numeral.Five]: ChordQuality.Major,
  [Numeral.Six]: ChordQuality.Minor,
  [Numeral.Seven]: ChordQuality.Diminished,
  [Numeral.FiveSeven]: ChordQuality.Dominant7,
};

/** The chord a numeral names in the major key of a key signature: its notes, root first. */
export function chordIn(
  keyFifths: number,
  numeral: Numeral,
): { notes: Pitch[]; quality: NumeralQuality } {
  return {
    notes: numeralChord(keyTonic(keyFifths, Mode.Major), numeral),
    quality: QUALITIES[numeral],
  };
}

/** The chord sounding at `beat`, if one has started. */
export function chordAt(analysis: SongAnalysis, beat: number): SongChord | undefined {
  return analysis.chords.findLast((chord) => chord.start <= beat + 1e-9);
}

/** The chord before `chord`. */
export function chordBefore(analysis: SongAnalysis, chord: SongChord): SongChord | undefined {
  return analysis.chords[analysis.chords.indexOf(chord) - 1];
}
