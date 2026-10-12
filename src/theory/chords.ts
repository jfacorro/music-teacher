/**
 * Chord and interval names for free play (PLAN.md §9). Works on pitch classes, so any
 * voicing or inversion of a chord is recognized; the bass note tells the inversion.
 */
import { pitchClass, type Alter, type Step } from './pitch';

export type ChordQuality =
  | 'major'
  | 'minor'
  | 'diminished'
  | 'augmented'
  | 'sus2'
  | 'sus4'
  | 'dominant7'
  | 'major7'
  | 'minor7'
  | 'halfDiminished7'
  | 'diminished7';

export type IntervalName =
  | 'minorSecond'
  | 'majorSecond'
  | 'minorThird'
  | 'majorThird'
  | 'perfectFourth'
  | 'tritone'
  | 'perfectFifth'
  | 'minorSixth'
  | 'majorSixth'
  | 'minorSeventh'
  | 'majorSeventh'
  | 'octave';

export interface Chord {
  /** Pitch class of the root, 0 = C. */
  root: number;
  quality: ChordQuality;
  /** Pitch class of the lowest note; differs from the root for inversions. */
  bass: number;
}

/** Semitones above the root, in ascending order. */
const TEMPLATES: readonly [ChordQuality, readonly number[]][] = [
  ['major', [0, 4, 7]],
  ['minor', [0, 3, 7]],
  ['diminished', [0, 3, 6]],
  ['augmented', [0, 4, 8]],
  ['sus2', [0, 2, 7]],
  ['sus4', [0, 5, 7]],
  ['dominant7', [0, 4, 7, 10]],
  ['major7', [0, 4, 7, 11]],
  ['minor7', [0, 3, 7, 10]],
  ['halfDiminished7', [0, 3, 6, 10]],
  ['diminished7', [0, 3, 6, 9]],
];

const INTERVALS: readonly IntervalName[] = [
  'octave',
  'minorSecond',
  'majorSecond',
  'minorThird',
  'majorThird',
  'perfectFourth',
  'tritone',
  'perfectFifth',
  'minorSixth',
  'majorSixth',
  'minorSeventh',
  'majorSeventh',
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
  if (distance === 12) return 'octave';
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
