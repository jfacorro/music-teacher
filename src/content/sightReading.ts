/**
 * Sight-reading drills (PLAN.md milestone 4.3): short melodies made up on the spot, using only
 * what the learner has been taught. A drill comes from a seed, so the same seed always gives the
 * same drill (to try it again), and a new seed gives fresh music.
 *
 * Each level opens when the unit that teaches its reading is finished, from the right hand in
 * the treble clef with quarter and half notes, to rests and eighth notes, the left hand in the
 * bass clef, both hands, the keys of G and F major, neighbor notes with their sharps, and the
 * keys of Unit 12 (D and B♭ major, A, E and D minor).
 *
 * The music follows a few rules so it sounds like a tune and fits the hand: four bars of 4/4 in
 * a five-finger position (no stretching or moving the hand), mostly steps with some small
 * leaps, a step back after a leap, and an ending on the key note, approached by step.
 */
import { type Finger, Hand, type Score, type ScoreNote, wholeMeasures } from '../engine/score';
import { HandFilter } from '../engine/session';
import { newSeed, pick, pickWeighted, type Random, seededRandom, shuffled } from '../lib/random';
import {
  type Alter,
  makePitch,
  type NoteString,
  type Pitch,
  pitchClass,
  pitchOf,
} from '../theory/pitch';
import type { Unit } from './courses';
import { isUnitFinished, type LessonState } from './unlock';

export const DrillLevel = {
  /** Right hand, treble clef: quarter, half and whole notes. */
  Treble: 'treble',
  /** Right hand, with rests and eighth notes too. */
  TrebleRhythm: 'trebleRhythm',
  /** Left hand, bass clef. */
  Bass: 'bass',
  /** A right-hand melody over left-hand bass notes. */
  HandsTogether: 'handsTogether',
  /** G major or F major, with their key signatures; either hand. */
  Keys: 'keys',
  /** Neighbor notes a half step below, written with a sharp (C major or A minor). */
  Accidentals: 'accidentals',
  /** D and B♭ major, A, E and D minor, with their key signatures; either hand. */
  MoreKeys: 'moreKeys',
} as const;
export type DrillLevel = (typeof DrillLevel)[keyof typeof DrillLevel];

/** Easiest first. */
export const DRILL_LEVELS: readonly DrillLevel[] = Object.values(DrillLevel);

/** Each level opens once this unit (which teaches what it reads) is finished. */
export const DRILL_UNITS: Readonly<Record<DrillLevel, string>> = {
  [DrillLevel.Treble]: 'u3',
  [DrillLevel.TrebleRhythm]: 'u3',
  [DrillLevel.Bass]: 'u4',
  [DrillLevel.HandsTogether]: 'u5',
  [DrillLevel.Keys]: 'u7',
  [DrillLevel.Accidentals]: 'u8',
  [DrillLevel.MoreKeys]: 'u12',
};

/** The levels open now, easiest first. */
export function openDrillLevels(
  units: readonly Unit[],
  states: ReadonlyMap<string, LessonState>,
): DrillLevel[] {
  const finished = new Set(
    units.filter((unit) => isUnitFinished(unit, states)).map((unit) => unit.id),
  );
  return DRILL_LEVELS.filter((level) => finished.has(DRILL_UNITS[level]));
}

/** Five keys under the five fingers. */
interface Position {
  hand: Hand;
  /** Lowest first: fingers 1–5 for the right hand, 5–1 for the left. */
  notes: readonly NoteString[];
  /** Key signature (sharps positive, flats negative). */
  keyFifths: number;
  /** The music ends on the signature's minor key note rather than its major one. */
  minor: boolean;
}

const position = (hand: Hand, keyFifths: number, ...notes: NoteString[]): Position => ({
  hand,
  notes,
  keyFifths,
  minor: false,
});
const minorPosition = (hand: Hand, keyFifths: number, ...notes: NoteString[]): Position => ({
  ...position(hand, keyFifths, ...notes),
  minor: true,
});

/** C major around middle C (both clefs' first positions, Units 1–4). */
const C_RIGHT = position(Hand.Right, 0, 'C4', 'D4', 'E4', 'F4', 'G4');
const C_LEFT = position(Hand.Left, 0, 'C3', 'D3', 'E3', 'F3', 'G3');
/** Still C major, from G: higher in the treble clef, lower in the bass clef (Units 3–4). */
const G_RIGHT = position(Hand.Right, 0, 'G4', 'A4', 'B4', 'C5', 'D5');
const G_LEFT = position(Hand.Left, 0, 'G2', 'A2', 'B2', 'C3', 'D3');
/**
 * G major and F major (Unit 7), in keys its scales cover: mostly with the sharp or flat under a
 * finger (up to the key note from C), or from the key note itself.
 */
const G_MAJOR_RIGHT = position(Hand.Right, 1, 'C5', 'D5', 'E5', 'F#5', 'G5');
const G_MAJOR_RIGHT_LOW = position(Hand.Right, 1, 'G4', 'A4', 'B4', 'C5', 'D5');
const G_MAJOR_LEFT = position(Hand.Left, 1, 'C4', 'D4', 'E4', 'F#4', 'G4');
const G_MAJOR_LEFT_LOW = position(Hand.Left, 1, 'G3', 'A3', 'B3', 'C4', 'D4');
const F_MAJOR_RIGHT = position(Hand.Right, -1, 'F4', 'G4', 'A4', 'Bb4', 'C5');
const F_MAJOR_LEFT = position(Hand.Left, -1, 'F3', 'G3', 'A3', 'Bb3', 'C4');
/** A minor (Unit 8), from its key note. */
const A_MINOR_RIGHT = minorPosition(Hand.Right, 0, 'A4', 'B4', 'C5', 'D5', 'E5');
/** Unit 12's keys, each from its key note. */
const D_MAJOR_RIGHT = position(Hand.Right, 2, 'D4', 'E4', 'F#4', 'G4', 'A4');
const D_MAJOR_LEFT = position(Hand.Left, 2, 'D3', 'E3', 'F#3', 'G3', 'A3');
const B_FLAT_MAJOR_RIGHT = position(Hand.Right, -2, 'Bb3', 'C4', 'D4', 'Eb4', 'F4');
const B_FLAT_MAJOR_LEFT = position(Hand.Left, -2, 'Bb2', 'C3', 'D3', 'Eb3', 'F3');
const A_MINOR_LEFT = minorPosition(Hand.Left, 0, 'A2', 'B2', 'C3', 'D3', 'E3');
const E_MINOR_RIGHT = minorPosition(Hand.Right, 1, 'E4', 'F#4', 'G4', 'A4', 'B4');
const E_MINOR_LEFT = minorPosition(Hand.Left, 1, 'E3', 'F#3', 'G3', 'A3', 'B3');
const D_MINOR_RIGHT = minorPosition(Hand.Right, -1, 'D4', 'E4', 'F4', 'G4', 'A4');
const D_MINOR_LEFT = minorPosition(Hand.Left, -1, 'D3', 'E3', 'F3', 'G3', 'A3');

/** A bar's rhythm, in beats (quarter notes); negative: a rest. */
type BarRhythm = readonly number[];

const QUARTERS_AND_HALVES: readonly BarRhythm[] = [
  [1, 1, 1, 1],
  [2, 1, 1],
  [1, 1, 2],
  [2, 2],
  [1, 2, 1],
];
const WITH_EIGHTHS: readonly BarRhythm[] = [
  [0.5, 0.5, 1, 1, 1],
  [1, 0.5, 0.5, 1, 1],
  [1, 1, 0.5, 0.5, 1],
  [0.5, 0.5, 0.5, 0.5, 2],
  [2, 0.5, 0.5, 1],
];
/** Never a rest first: the drill starts on a note. */
const WITH_RESTS: readonly BarRhythm[] = [
  [1, 1, 1, -1],
  [2, 1, -1],
  [1, -1, 1, 1],
  [1, 1, -1, 1],
];
/** The last bar ends on a long note. */
const ENDINGS: readonly BarRhythm[] = [[1, 1, 2], [2, 2], [4]];
const ENDINGS_WITH_EIGHTHS: readonly BarRhythm[] = [...ENDINGS, [0.5, 0.5, 1, 2]];

const RhythmKind = {
  /** Quarter, half and whole notes. */
  Plain: 'plain',
  /** Plus rests and eighth notes: each drill has some of both. */
  Mixed: 'mixed',
} as const;
type RhythmKind = (typeof RhythmKind)[keyof typeof RhythmKind];

interface LevelPlan {
  positions: readonly Position[];
  rhythm: RhythmKind;
  /** Quarter notes per minute, for playing along. */
  tempo: number;
  /** Hands together: the left hand plays the bass of each bar in this position. */
  bass?: Position;
  /** One or two neighbor notes a half step below, written with a sharp. */
  neighbors?: boolean;
}

const PLANS: Readonly<Record<DrillLevel, LevelPlan>> = {
  [DrillLevel.Treble]: { positions: [C_RIGHT, G_RIGHT], rhythm: RhythmKind.Plain, tempo: 60 },
  [DrillLevel.TrebleRhythm]: {
    positions: [C_RIGHT, G_RIGHT],
    rhythm: RhythmKind.Mixed,
    tempo: 66,
  },
  [DrillLevel.Bass]: { positions: [C_LEFT, G_LEFT], rhythm: RhythmKind.Mixed, tempo: 66 },
  [DrillLevel.HandsTogether]: {
    positions: [C_RIGHT],
    rhythm: RhythmKind.Plain,
    tempo: 60,
    bass: C_LEFT,
  },
  [DrillLevel.Keys]: {
    positions: [
      G_MAJOR_RIGHT,
      G_MAJOR_RIGHT_LOW,
      G_MAJOR_LEFT,
      G_MAJOR_LEFT_LOW,
      F_MAJOR_RIGHT,
      F_MAJOR_LEFT,
    ],
    rhythm: RhythmKind.Mixed,
    tempo: 66,
  },
  [DrillLevel.Accidentals]: {
    positions: [C_RIGHT, C_LEFT, A_MINOR_RIGHT],
    rhythm: RhythmKind.Plain,
    tempo: 60,
    neighbors: true,
  },
  [DrillLevel.MoreKeys]: {
    positions: [
      D_MAJOR_RIGHT,
      D_MAJOR_LEFT,
      B_FLAT_MAJOR_RIGHT,
      B_FLAT_MAJOR_LEFT,
      A_MINOR_RIGHT,
      A_MINOR_LEFT,
      E_MINOR_RIGHT,
      E_MINOR_LEFT,
      D_MINOR_RIGHT,
      D_MINOR_LEFT,
    ],
    rhythm: RhythmKind.Mixed,
    tempo: 66,
  },
};

const BARS = 4;
const BEATS_PER_BAR = 4;

export interface Drill {
  level: DrillLevel;
  seed: number;
  score: Score;
  /** The hands it's for. */
  hands: HandFilter;
  /** It's in a minor key (the key signature's relative minor). */
  minor: boolean;
}

/** The drill for this level and seed (always the same one). */
export function makeDrill(level: DrillLevel, seed: number): Drill {
  const plan = PLANS[level];
  const random = seededRandom(seed);
  const melodyAt = pick(random, plan.positions);
  const rhythm = barRhythms(random, plan.rhythm);
  const lengths = rhythm.flat().filter((beats) => beats > 0);
  const { tune, sharpened } = plan.neighbors
    ? withNeighbors(random, melodyAt, lengths.length)
    : { tune: melody(random, melodyAt, lengths.length), sharpened: new Set<number>() };

  const notes: ScoreNote[] = [];
  let beat = 0;
  let index = 0;
  for (const beats of rhythm.flat()) {
    if (beats > 0) {
      const at = tune[index]!;
      const pitch = pitchOf(melodyAt.notes[at]!);
      notes.push({
        pitch: sharpened.has(index)
          ? makePitch(pitch.step, (pitch.alter + 1) as Alter, pitch.octave)
          : pitch,
        start: beat,
        duration: beats,
        hand: melodyAt.hand,
        // The first note's finger shows where the hand goes, as in method books.
        ...(index === 0 && { finger: fingerOf(melodyAt, at) }),
      });
      index++;
    }
    beat += Math.abs(beats);
  }
  if (plan.bass) notes.push(...bassLine(plan.bass, melodyAt, notes));
  notes.sort((a, b) => a.start - b.start || a.pitch.midi - b.pitch.midi);

  return {
    level,
    seed,
    score: {
      tempo: plan.tempo,
      timeSignature: [BEATS_PER_BAR, 4],
      notes,
      measures: wholeMeasures(notes, [BEATS_PER_BAR, 4]),
      ...(melodyAt.keyFifths !== 0 && { keyFifths: melodyAt.keyFifths }),
    },
    hands: plan.bass ? HandFilter.Both : melodyAt.hand,
    minor: melodyAt.minor,
  };
}

/** What a drill sounds like, to tell drills apart. */
export function drillTune(drill: Drill): string {
  return drill.score.notes
    .map((note) => `${note.start}:${note.pitch.midi}:${note.duration}`)
    .join(' ');
}

/** Tries before settling for a drill that was played recently (very unlikely). */
const FRESH_TRIES = 50;

/** A seed for a drill unlike the recent ones (given by their seeds). */
export function freshDrillSeed(
  level: DrillLevel,
  recentSeeds: readonly number[],
  random: Random = Math.random,
): number {
  const recent = new Set(recentSeeds.map((seed) => drillTune(makeDrill(level, seed))));
  let seed = newSeed(random);
  for (let i = 1; i < FRESH_TRIES && recent.has(drillTune(makeDrill(level, seed))); i++) {
    seed = newSeed(random);
  }
  return seed;
}

function fingerOf(at: Position, index: number): Finger {
  return (at.hand === Hand.Right ? index + 1 : 5 - index) as Finger;
}

function barRhythms(random: Random, kind: RhythmKind): BarRhythm[] {
  if (kind === RhythmKind.Plain) {
    return [
      ...Array.from({ length: BARS - 1 }, () => pick(random, QUARTERS_AND_HALVES)),
      pick(random, ENDINGS),
    ];
  }
  // Some eighth notes and some rests in every drill, the third bar anything.
  const sets = shuffled(random, [
    WITH_EIGHTHS,
    WITH_RESTS,
    [...QUARTERS_AND_HALVES, ...WITH_EIGHTHS, ...WITH_RESTS],
  ]);
  return [...sets.map((set) => pick(random, set)), pick(random, ENDINGS_WITH_EIGHTHS)];
}

/** The key note's pitch class (C = 0) for a key signature: its major key. */
const tonicOf = (keyFifths: number) => (((keyFifths * 7) % 12) + 12) % 12;
/** The key note where a position's music ends: the major key's, or its relative minor's. */
const keyNoteOf = (at: Position) => (tonicOf(at.keyFifths) + (at.minor ? 9 : 0)) % 12;

/** Moves from one finger to the next, by how many keys, with how often they come. */
const MOVES: readonly (readonly [number, number])[] = [
  [1, 30],
  [-1, 30],
  [0, 10],
  [2, 10],
  [-2, 10],
  [3, 5],
  [-3, 5],
];

/** A leap: more than a step. */
const isLeap = (move: number) => Math.abs(move) >= 2;

const MELODY_TRIES = 20;
const TRITONE = 6;

/** Two leaps one after the other (in key indexes). */
export function hasLeapAfterLeap(tune: readonly number[]): boolean {
  return tune.some(
    (index, i) => i >= 2 && isLeap(index - tune[i - 1]!) && isLeap(tune[i - 1]! - tune[i - 2]!),
  );
}

/**
 * Which of the position's keys to play (indexes), `count` of them: starting on a note of the
 * key chord and ending on the key note, approached by step.
 */
function melody(random: Random, at: Position, count: number): number[] {
  const midis = at.notes.map((note) => pitchOf(note).midi);
  const pitchClasses = midis.map(pitchClass);
  /** An augmented fourth (C to F#, Bb to E) is hard to hear and sing: never leap one. */
  const tritone = (from: number, to: number) => Math.abs(midis[to]! - midis[from]!) === TRITONE;
  const tonicClass = keyNoteOf(at);
  const tonic = pitchClasses.indexOf(tonicClass);
  const chord = [0, at.minor ? 3 : 4, 7].map((interval) => (tonicClass + interval) % 12);
  const chordTones = pitchClasses.flatMap((pc, index) => (chord.includes(pc) ? [index] : []));
  const fits = (index: number) => index >= 0 && index < at.notes.length;

  // The ending could follow a leap with another, or leap a tritone: try again (a few times at
  // most).
  for (let attempt = 1; ; attempt++) {
    const tune = [pick(random, chordTones)];
    while (tune.length < count - 2) {
      const last = tune.at(-1)!;
      const before = tune.length > 1 ? last - tune.at(-2)! : 0;
      const moves = MOVES.filter(([move]) => fits(last + move) && !tritone(last, last + move))
        // No key three times in a row, and no two leaps in a row.
        .filter(([move]) => !(move === 0 && before === 0 && tune.length > 1))
        .filter(([move]) => !(isLeap(before) && isLeap(move)))
        // After a leap, a step back the other way is likeliest.
        .map(([move, weight]): [number, number] => [
          move,
          isLeap(before) && Math.sign(move) === -Math.sign(before) ? weight * 4 : weight,
        ]);
      tune.push(last + pickWeighted(random, moves));
    }
    // Then a step onto the key note (in five keys, the step before it is at most a fourth away).
    const last = tune.at(-1)!;
    const approach = [tonic - 1, tonic + 1]
      .filter(fits)
      .sort((a, b) => Math.abs(a - last) - Math.abs(b - last))[0]!;
    const whole = [...tune, approach, tonic];
    const awkward = hasLeapAfterLeap(whole) || tritone(last, approach);
    if (attempt >= MELODY_TRIES || !awkward) return whole;
  }
}

/**
 * A melody (keys of the position, by index) with one or two neighbor notes: a key, the one a
 * whole step below raised a half step, and the key again (Unit 8: E, D♯, E). Returns the
 * indexes of the notes to sharpen. The neighbors stay clear of the ending.
 */
function withNeighbors(
  random: Random,
  at: Position,
  count: number,
): { tune: number[]; sharpened: Set<number> } {
  const midis = at.notes.map((note) => pitchOf(note).midi);
  let tune = melody(random, at, count);
  for (let attempt = 1; attempt <= MELODY_TRIES; attempt++) {
    const sharpened = new Set<number>();
    const result = [...tune];
    // A figure on note i: i, i + 1 (the neighbor) and i + 2, before the last two notes.
    const fitsAt = (notes: readonly number[], i: number) => {
      const key = notes[i]!;
      if (key < 1 || midis[key]! - midis[key - 1]! !== 2) return false;
      const next = notes[i + 3];
      if (next === undefined || Math.abs(next - key) > 3) return false;
      if (Math.abs(midis[next]! - midis[key]!) === TRITONE) return false;
      const changed = [...notes];
      changed.splice(i + 1, 2, key - 1, key);
      return !hasLeapAfterLeap(changed);
    };
    let spots = Array.from({ length: Math.max(0, count - 5) }, (_, i) => i).filter((i) =>
      fitsAt(result, i),
    );
    const wanted = random() < 0.5 ? 2 : 1;
    while (spots.length > 0 && sharpened.size < wanted) {
      const i = pick(random, spots);
      result.splice(i + 1, 2, result[i]! - 1, result[i]!);
      sharpened.add(i + 1);
      spots = spots.filter((j) => (j > i + 2 || j + 2 < i) && fitsAt(result, j));
    }
    if (sharpened.size > 0) return { tune: result, sharpened };
    tune = melody(random, at, count);
  }
  return { tune, sharpened: new Set() };
}

/** Chords for the bass: on the key note (I), the fourth (IV) and the fifth (V). */
const CHORD_ROOTS = [0, 5, 7];

/**
 * The left hand's bass, a whole note per bar: the chord that fits the bar's melody best (the
 * key chord first and last).
 */
function bassLine(at: Position, melodyAt: Position, melody: readonly ScoreNote[]): ScoreNote[] {
  const tonicClass = tonicOf(melodyAt.keyFifths);
  const bassPitches = at.notes.map(pitchOf);
  return Array.from({ length: BARS }, (_, bar) => {
    const start = bar * BEATS_PER_BAR;
    const inBar = melody.filter(
      (note) => note.start >= start && note.start < start + BEATS_PER_BAR,
    );
    const fitting = (root: number) => {
      const chord = [0, 4, 7].map((interval) => (tonicClass + root + interval) % 12);
      return inBar.reduce(
        (sum, note) => sum + (chord.includes(pitchClass(note.pitch.midi)) ? note.duration : 0),
        0,
      );
    };
    const root =
      bar === 0 || bar === BARS - 1
        ? 0
        : CHORD_ROOTS.reduce((best, root) => (fitting(root) > fitting(best) ? root : best));
    const index = bassPitches.findIndex(
      (pitch) => pitchClass(pitch.midi) === (tonicClass + root) % 12,
    );
    const pitch: Pitch = bassPitches[index]!;
    return {
      pitch,
      start,
      duration: BEATS_PER_BAR,
      hand: at.hand,
      ...(bar === 0 && { finger: fingerOf(at, index) }),
    };
  });
}
