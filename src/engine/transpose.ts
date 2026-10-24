/**
 * Moving music into a singer's range (PLAN.md milestone 6.3): by whole octaves first, then into
 * another key when no octave fits.
 */
import { midiFor, STEPS, type Alter, type Pitch } from '../theory/pitch';
import { Hand, type Score } from './score';

const mod = (value: number, by: number) => ((value % by) + by) % by;

/** Steps from C of a major key's tonic, by its key signature (fifths): C 0, G 4, F 3… */
const tonicStep = (fifths: number) => mod(4 * fifths, 7);

/** The key signature a semitone shift leads to, from −5 (five flats) to 6 sharps. */
function shiftedFifths(fifths: number, semitones: number): number {
  const shifted = mod(fifths + 7 * semitones + 5, 12) - 5;
  return shifted;
}

/** `pitch` moved by `semitones`, spelled for the new key (`diatonic` letter steps). */
function movePitch(pitch: Pitch, semitones: number, diatonic: number): Pitch {
  const index = pitch.octave * 7 + STEPS.indexOf(pitch.step) + diatonic;
  const step = STEPS[mod(index, 7)]!;
  const octave = Math.floor(index / 7);
  const midi = pitch.midi + semitones;
  return { midi, step, octave, alter: (midi - midiFor(step, 0, octave)) as Alter };
}

/** The score moved up (or down) by `semitones`, into the matching key. */
export function transposeScore(score: Score, semitones: number): Score {
  if (semitones === 0) return score;
  const fifths = score.keyFifths ?? 0;
  const octaves = Math.trunc(semitones / 12);
  const rest = semitones - 12 * octaves;
  const keyFifths = rest === 0 ? fifths : shiftedFifths(fifths, rest);
  let letters = mod(tonicStep(keyFifths) - tonicStep(fifths), 7);
  if (rest < 0 && letters > 0) letters -= 7;
  const diatonic = 7 * octaves + letters;
  return {
    ...score,
    keyFifths,
    notes: score.notes.map((note) => ({
      ...note,
      pitch: movePitch(note.pitch, semitones, diatonic),
    })),
  };
}

export interface RangeFit {
  score: Score;
  /** How far it was moved, in semitones. */
  semitones: number;
  /** It fits the range (otherwise it's as close as it gets). */
  fits: boolean;
}

/**
 * The melody moved into the range: by the whole octaves that fit it, nearest the comfortable note
 * in the middle; when none fits, into the key that does (or overflows least). Written low, it's on
 * the bass staff (the left hand's), otherwise on the treble staff.
 */
export function fitToRange(
  score: Score,
  range: { low: number; high: number; comfortable: number },
): RangeFit {
  const pitches = score.notes.map((note) => note.pitch.midi);
  const low = Math.min(...pitches);
  const high = Math.max(...pitches);
  const middle = (low + high) / 2;
  const overflow = (shift: number) =>
    Math.max(0, range.low - (low + shift)) + Math.max(0, high + shift - range.high);
  const distance = (shift: number) => Math.abs(middle + shift - range.comfortable);
  const best = (shifts: number[]) =>
    shifts.reduce((a, b) =>
      overflow(b) < overflow(a) || (overflow(b) === overflow(a) && distance(b) < distance(a))
        ? b
        : a,
    );

  const octaves = [-4, -3, -2, -1, 0, 1, 2, 3].map((k) => 12 * k);
  let semitones = best(octaves);
  if (overflow(semitones) > 0) {
    const all = Array.from({ length: 97 }, (_, i) => i - 48);
    semitones = best(all);
  }
  const moved = transposeScore(score, semitones);
  const hand = middle + semitones < 60 ? Hand.Left : Hand.Right;
  return {
    score: { ...moved, notes: moved.notes.map((note) => ({ ...note, hand })) },
    semitones,
    fits: overflow(semitones) === 0,
  };
}
