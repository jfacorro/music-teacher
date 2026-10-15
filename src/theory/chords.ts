/**
 * Chord and interval names for free play (PLAN.md §9). Works on pitch classes, so any
 * voicing or inversion of a chord is recognized; the bass note tells the inversion.
 */
import { pitchClass, type Alter, type Step } from './pitch';

export const ChordQuality = {
  Major: 'major',
  Minor: 'minor',
  Diminished: 'diminished',
  Augmented: 'augmented',
  Sus2: 'sus2',
  Sus4: 'sus4',
  Dominant7: 'dominant7',
  Major7: 'major7',
  Minor7: 'minor7',
  HalfDiminished7: 'halfDiminished7',
  Diminished7: 'diminished7',
} as const;
export type ChordQuality = (typeof ChordQuality)[keyof typeof ChordQuality];

export const IntervalName = {
  MinorSecond: 'minorSecond',
  MajorSecond: 'majorSecond',
  MinorThird: 'minorThird',
  MajorThird: 'majorThird',
  PerfectFourth: 'perfectFourth',
  Tritone: 'tritone',
  PerfectFifth: 'perfectFifth',
  MinorSixth: 'minorSixth',
  MajorSixth: 'majorSixth',
  MinorSeventh: 'minorSeventh',
  MajorSeventh: 'majorSeventh',
  Octave: 'octave',
} as const;
export type IntervalName = (typeof IntervalName)[keyof typeof IntervalName];

export interface Chord {
  /** Pitch class of the root, 0 = C. */
  root: number;
  quality: ChordQuality;
  /** Pitch class of the lowest note; differs from the root for inversions. */
  bass: number;
}

/** Semitones above the root, in ascending order. */
const TEMPLATES: readonly [ChordQuality, readonly number[]][] = [
  [ChordQuality.Major, [0, 4, 7]],
  [ChordQuality.Minor, [0, 3, 7]],
  [ChordQuality.Diminished, [0, 3, 6]],
  [ChordQuality.Augmented, [0, 4, 8]],
  [ChordQuality.Sus2, [0, 2, 7]],
  [ChordQuality.Sus4, [0, 5, 7]],
  [ChordQuality.Dominant7, [0, 4, 7, 10]],
  [ChordQuality.Major7, [0, 4, 7, 11]],
  [ChordQuality.Minor7, [0, 3, 7, 10]],
  [ChordQuality.HalfDiminished7, [0, 3, 6, 10]],
  [ChordQuality.Diminished7, [0, 3, 6, 9]],
];

const INTERVALS: readonly IntervalName[] = [
  IntervalName.Octave,
  IntervalName.MinorSecond,
  IntervalName.MajorSecond,
  IntervalName.MinorThird,
  IntervalName.MajorThird,
  IntervalName.PerfectFourth,
  IntervalName.Tritone,
  IntervalName.PerfectFifth,
  IntervalName.MinorSixth,
  IntervalName.MajorSixth,
  IntervalName.MinorSeventh,
  IntervalName.MajorSeventh,
];

/** The chord formed by the held keys, or null if they don't make a known chord. */
export function identifyChord(midis: readonly number[]): Chord | null {
  if (midis.length === 0) return null;
  const bass = pitchClass(Math.min(...midis));
  const classes = [...new Set(midis.map(pitchClass))];
  if (classes.length < 3) return null;

  // Try the bass first, so ambiguous chords (augmented, diminished 7th) are named from it.
  const roots = [bass, ...classes.filter((pc) => pc !== bass)];
  for (const root of roots) {
    const intervals = classes.map((pc) => (pc - root + 12) % 12).sort((a, b) => a - b);
    const match = TEMPLATES.find(
      ([, template]) =>
        template.length === intervals.length && template.every((step, i) => step === intervals[i]),
    );
    if (match) return { root, quality: match[0], bass };
  }
  return null;
}

/** The interval between two held keys (any octave apart counts by its simple size). */
export function identifyInterval(midis: readonly number[]): IntervalName | null {
  const unique = [...new Set(midis)].sort((a, b) => a - b);
  if (unique.length !== 2) return null;
  const distance = unique[1]! - unique[0]!;
  if (distance === 12) return IntervalName.Octave;
  return INTERVALS[distance % 12] ?? null;
}

/** Usual spelling for chord roots: sharps for C♯ and F♯, flats for the others. */
const ROOT_SPELLINGS: readonly (readonly [Step, Alter])[] = [
  ['C', 0], ['C', 1], ['D', 0], ['E', -1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0],
]; // prettier-ignore

export function rootSpelling(pc: number): { step: Step; alter: Alter } {
  const [step, alter] = ROOT_SPELLINGS[pitchClass(pc)]!;
  return { step, alter };
}
