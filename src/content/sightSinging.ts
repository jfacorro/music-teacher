/**
 * Sight-singing drills (PLAN.md milestone 6.5): the sight-reading generator's short melodies,
 * made up on the spot, for the voice to read from the staff. A drill comes from a seed, as for
 * the piano, and is moved into the singer's range when it's sung (`fitToRange`).
 *
 * Levels go from steps to leaps, as the voice course does: steps over the first five notes of
 * the scale; then leaps (up to a fifth) over an octave, from the key note or from the fifth
 * below; then the same with rests and eighth notes. They're in major keys (C, G, F and D), and
 * open once Voice Unit 7 (reading from the staff) is finished.
 */
import { Hand, type Score, type ScoreNote, wholeMeasures } from '../engine/score';
import { newSeed, pick, type Random, seededRandom } from '../lib/random';
import { type NoteString, pitchOf } from '../theory/pitch';
import type { Unit } from './courses';
import { barRhythms, melody, MOVES, type Position, position, RhythmKind } from './sightReading';
import { isUnitFinished, type LessonState } from './unlock';

export const SingDrillLevel = {
  /** Steps over five notes from the key note: quarter, half and whole notes. */
  Steps: 'steps',
  /** Leaps up to a fifth, over an octave. */
  Leaps: 'leaps',
  /** Leaps, with rests and eighth notes too. */
  Rhythms: 'rhythms',
} as const;
export type SingDrillLevel = (typeof SingDrillLevel)[keyof typeof SingDrillLevel];

/** Easiest first. */
export const SING_DRILL_LEVELS: readonly SingDrillLevel[] = Object.values(SingDrillLevel);

/** Each level opens once this voice unit is finished. */
export const SING_DRILL_UNITS: Readonly<Record<SingDrillLevel, string>> = {
  [SingDrillLevel.Steps]: 'v7',
  [SingDrillLevel.Leaps]: 'v7',
  [SingDrillLevel.Rhythms]: 'v7',
};

/** The levels open now, easiest first. */
export function openSingDrillLevels(
  units: readonly Unit[],
  states: ReadonlyMap<string, LessonState>,
): SingDrillLevel[] {
  const finished = new Set(
    units.filter((unit) => isUnitFinished(unit, states)).map((unit) => unit.id),
  );
  return SING_DRILL_LEVELS.filter((level) => finished.has(SING_DRILL_UNITS[level]));
}

// A voice has no hands: the hand only places the notes on a staff until they're moved.
const scale = (keyFifths: number, ...notes: NoteString[]): Position =>
  position(Hand.Right, keyFifths, ...notes);

/** The key note and the four above it. */
const FIVE: readonly Position[] = [
  scale(0, 'C4', 'D4', 'E4', 'F4', 'G4'),
  scale(1, 'G3', 'A3', 'B3', 'C4', 'D4'),
  scale(-1, 'F4', 'G4', 'A4', 'Bb4', 'C5'),
];
/** An octave from the key note, or from the fifth below. */
const OCTAVE: readonly Position[] = [
  scale(0, 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'),
  scale(0, 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'),
  scale(1, 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'),
  scale(1, 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5'),
  scale(-1, 'F3', 'G3', 'A3', 'Bb3', 'C4', 'D4', 'E4', 'F4'),
  scale(-1, 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5'),
  scale(2, 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5'),
  scale(2, 'A3', 'B3', 'C#4', 'D4', 'E4', 'F#4', 'G4', 'A4'),
];

/** Steps only: up or down the scale, now and then the same note again. */
const STEPS: readonly (readonly [number, number])[] = [
  [1, 40],
  [-1, 40],
  [0, 10],
];
/** The piano's moves (to a fourth), and now and then a fifth. */
const LEAPS: readonly (readonly [number, number])[] = [...MOVES, [4, 3], [-4, 3]];

interface LevelPlan {
  positions: readonly Position[];
  moves: readonly (readonly [number, number])[];
  rhythm: RhythmKind;
  /** Quarter notes per minute. */
  tempo: number;
}

const PLANS: Readonly<Record<SingDrillLevel, LevelPlan>> = {
  [SingDrillLevel.Steps]: { positions: FIVE, moves: STEPS, rhythm: RhythmKind.Plain, tempo: 60 },
  [SingDrillLevel.Leaps]: { positions: OCTAVE, moves: LEAPS, rhythm: RhythmKind.Plain, tempo: 60 },
  [SingDrillLevel.Rhythms]: {
    positions: OCTAVE,
    moves: LEAPS,
    rhythm: RhythmKind.Mixed,
    tempo: 66,
  },
};

const TIME_SIGNATURE: [number, number] = [4, 4];

export interface SingDrill {
  level: SingDrillLevel;
  seed: number;
  /** In its written octave: moved into the singer's range when sung. */
  score: Score;
}

/** The drill for this level and seed (always the same one). */
export function makeSingDrill(level: SingDrillLevel, seed: number): SingDrill {
  const plan = PLANS[level];
  const random = seededRandom(seed);
  const at = pick(random, plan.positions);
  const rhythm = barRhythms(random, plan.rhythm);
  const lengths = rhythm.flat().filter((beats) => beats > 0);
  const tune = melody(random, at, lengths.length, plan.moves);

  const notes: ScoreNote[] = [];
  let beat = 0;
  for (const beats of rhythm.flat()) {
    if (beats > 0) {
      notes.push({
        pitch: pitchOf(at.notes[tune[notes.length]!]!),
        start: beat,
        duration: beats,
        hand: at.hand,
      });
    }
    beat += Math.abs(beats);
  }
  return {
    level,
    seed,
    score: {
      tempo: plan.tempo,
      timeSignature: TIME_SIGNATURE,
      notes,
      measures: wholeMeasures(notes, TIME_SIGNATURE),
      ...(at.keyFifths !== 0 && { keyFifths: at.keyFifths }),
    },
  };
}

/** What a drill sounds like, to tell drills apart. */
const tuneOf = (drill: SingDrill) =>
  drill.score.notes.map((note) => `${note.start}:${note.pitch.midi}:${note.duration}`).join(' ');

/** Tries before settling for a drill that was sung recently (very unlikely). */
const FRESH_TRIES = 50;

/** A seed for a drill unlike the recent ones (given by their seeds). */
export function freshSingDrillSeed(
  level: SingDrillLevel,
  recentSeeds: readonly number[],
  random: Random = Math.random,
): number {
  const recent = new Set(recentSeeds.map((seed) => tuneOf(makeSingDrill(level, seed))));
  let seed = newSeed(random);
  for (let i = 1; i < FRESH_TRIES && recent.has(tuneOf(makeSingDrill(level, seed))); i++) {
    seed = newSeed(random);
  }
  return seed;
}
