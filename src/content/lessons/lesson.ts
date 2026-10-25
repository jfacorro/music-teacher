/**
 * Lesson format (PLAN.md §7). A lesson is a list of steps; its text lives in
 * `locales/<lang>/lessons/<id>.json` under `steps.<key>`, and note names in that text are
 * variables (`textVars`) filled in with the user's naming system.
 *
 * Step types:
 * - explain:  text, optionally with highlighted keys (and finger numbers), notes on a staff, or
 *             a little music showing a mark
 * - find:     press each of the given keys once, in any order
 * - exercise: a graded practice run (wait or tempo mode) of an inline score or a song
 * - quiz:     note-naming flash cards: a note on the staff, play its key
 * - rhythm:   tap any key along with a rhythm pattern (see engine/rhythm.ts)
 * - warmUp:   the vocal warm-up that starts each voice lesson (not graded)
 * - match:    sing back notes played from the singer's range (see engine/matchNote.ts)
 * - sing:     sing a melody (one note at a time), moved into the singer's range: waiting for
 *             each note, along with it, or after listening first (see engine/singing.ts)
 */
import { parseRhythm, RhythmError, RHYTHM_NOTE } from '../../engine/rhythm';
import { type Finger, Hand, hasPedalMarks, hasTouchMarks, type Score } from '../../engine/score';
import { GradedMode, HandFilter } from '../../engine/session';
import { SingMode } from '../../engine/singing';
import { describeValues, isValueOf } from '../../lib/values';
import { ChordQuality } from '../../theory/chords';
import { InvalidNoteError, parseNote, type Pitch } from '../../theory/pitch';
import { ScaleQuality, type TextVar } from '../textVars';
import { ScoreError, parseInlineScore } from '../loaders/inlineScore';
import { isSongId, loadSong, type SongId } from '../songs';

export const StepType = {
  Explain: 'explain',
  Find: 'find',
  Exercise: 'exercise',
  Quiz: 'quiz',
  Rhythm: 'rhythm',
  WarmUp: 'warmUp',
  Match: 'match',
  Sing: 'sing',
} as const;
export type StepType = (typeof StepType)[keyof typeof StepType];

export interface KeyHint {
  pitch: Pitch;
  finger?: Finger;
  /** The hand that plays it, when it isn't the step's. */
  hand?: Hand;
}

interface StepBase {
  /** Translation key under `steps.` in the lesson's locale file. */
  text: string;
  /** Notes, chords and scales named in the text. */
  textVars: Record<string, TextVar>;
}

/** The staves of a staff picture: treble, bass, or both (the grand staff). */
export const StaffClef = {
  Treble: 'treble',
  Bass: 'bass',
  Grand: 'grand',
} as const;
export type StaffClef = (typeof StaffClef)[keyof typeof StaffClef];

export interface StaffNotes {
  clef: StaffClef;
  notes: Pitch[];
  /** Write each note's name under it. */
  names: boolean;
  /**
   * All the notes in one bar (as quarter notes), so an accidental carries on to the notes
   * after it as in music; otherwise each note stands alone.
   */
  bar: boolean;
}

export interface ExplainStep extends StepBase {
  type: typeof StepType.Explain;
  keys: KeyHint[];
  hand: Hand;
  range: [number, number] | null;
  /** Notes shown on a staff above the keyboard. */
  staff: StaffNotes | null;
  /** A few bars of music shown above the keyboard, e.g. to show a mark (an inline score). */
  music: Score | null;
}

export interface FindStep extends StepBase {
  type: typeof StepType.Find;
  notes: Pitch[];
  range: [number, number] | null;
}

/** How the music is shown: falling notes or sheet music. */
export const ScoreView = {
  Falling: 'falling',
  Sheet: 'sheet',
} as const;
export type ScoreView = (typeof ScoreView)[keyof typeof ScoreView];

/**
 * Sheet music levels (PLAN.md §2.2): note names under the notes; no names; both staves
 * (the full grand staff even when practicing one hand). The first two show only the staff of
 * the hand being practiced.
 */
export const SheetNotation = {
  Names: 'names',
  Plain: 'plain',
  Grand: 'grand',
  /** Singing with letter note names: do, re, mi from the key note (movable do). */
  Syllables: 'syllables',
} as const;
export type SheetNotation = (typeof SheetNotation)[keyof typeof SheetNotation];

/** The piano's (and the Settings default's) levels. */
export const SHEET_NOTATIONS: readonly SheetNotation[] = [
  SheetNotation.Names,
  SheetNotation.Plain,
  SheetNotation.Grand,
];

/**
 * Singing's (milestone 6.5): one staff, with do, re, mi from the key note, note names or nothing
 * under the notes. Do, re, mi only with letter note names (`singNotations`).
 */
export const SING_NOTATIONS: readonly SheetNotation[] = [
  SheetNotation.Syllables,
  SheetNotation.Names,
  SheetNotation.Plain,
];

export interface ExerciseStep extends StepBase {
  type: typeof StepType.Exercise;
  /** The view the exercise starts in (the learner can switch). */
  view: ScoreView;
  /** The sheet music level it starts with; null = the learner's default (Settings). */
  notation: SheetNotation | null;
  mode: GradedMode;
  hands: HandFilter;
  score: Score;
  /** The song this exercise plays, if any (for its title). */
  song: SongId | null;
  metronome: boolean;
  /**
   * `dynamics` / `touch` / `pedal`: the loud and soft parts / the staccato, slurs, accents and
   * tenuto / the pedal marks must be played as written too (on a MIDI keyboard).
   */
  pass: { minStars: number; dynamics: boolean; touch: boolean; pedal: boolean };
}

/** The staff a quiz card is shown on; "auto": treble from middle C up, bass below. */
export const QuizClef = {
  Treble: 'treble',
  Bass: 'bass',
  Auto: 'auto',
} as const;
export type QuizClef = (typeof QuizClef)[keyof typeof QuizClef];

export interface QuizStep extends StepBase {
  type: typeof StepType.Quiz;
  /** The notes the cards are drawn from. */
  notes: Pitch[];
  /** How many cards. */
  count: number;
  clef: QuizClef;
  pass: { minStars: number };
}

export interface RhythmStep extends StepBase {
  type: typeof StepType.Rhythm;
  /** The pattern as a score: a note per tap, on the line of a one-line rhythm staff. */
  score: Score;
  view: ScoreView;
  metronome: boolean;
  pass: { minStars: number };
}

/** The vocal warm-up: breathing, humming, a siren and a five-note pattern, from the range. */
export interface WarmUpStep extends StepBase {
  type: typeof StepType.WarmUp;
}

/** The widest a match step reaches around the comfortable note, in semitones. */
export const MATCH_WITHIN_MAX = 24;

export interface MatchStep extends StepBase {
  type: typeof StepType.Match;
  /**
   * The notes asked: up to this many semitones either side of the comfortable note (within the
   * saved range); null = the whole range, as on the Tuner page.
   */
  within: number | null;
  /** How many notes. */
  count: number;
  pass: { minStars: number };
}

/** A melody to sing, in any key and octave: it's moved into the singer's range. */
export interface SingStep extends StepBase {
  type: typeof StepType.Sing;
  mode: SingMode;
  /** One note at a time; the notes' hands don't matter (written low, it's on the bass staff). */
  score: Score;
  /** The view it starts in: the notes in a lane (`falling`) or sheet music. */
  view: ScoreView;
  /** The sheet music level it starts with (one of `SING_NOTATIONS`); null = from Settings. */
  notation: SheetNotation | null;
  /** In tune within ±25 cents instead of ±50. */
  strict: boolean;
  /** Only the written octave counts (after moving into the range). */
  octave: boolean;
  /** The app plays the melody along (or each note first, waiting): on by default. */
  guide: boolean;
  /** Singing along: the metronome clicks the beat (it always counts in). */
  metronome: boolean;
  pass: { minStars: number };
}

export const QUIZ_CARDS_DEFAULT = 10;

export type LessonStep =
  ExplainStep | FindStep | ExerciseStep | QuizStep | RhythmStep | WarmUpStep | MatchStep | SingStep;

/** The steps graded toward the lesson's stars: all but explanations and warm-ups. */
export type GradedStep = Exclude<LessonStep, ExplainStep | WarmUpStep>;

export function isGraded(step: LessonStep): step is GradedStep {
  return step.type !== StepType.Explain && step.type !== StepType.WarmUp;
}

export interface Lesson {
  id: string;
  steps: LessonStep[];
}

/** Lesson errors name where the problem is, e.g. `lesson "u1-l2" › steps[2] › score › …`. */
export class LessonError extends Error {
  constructor(location: string, message: string) {
    super(`${location}: ${message}`);
    this.name = 'LessonError';
  }
}

const at = (location: string, part: string) => `${location} › ${part}`;

export async function parseLesson(id: string, input: unknown): Promise<Lesson> {
  const location = `lesson "${id}"`;
  const data = object(input, location);
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    throw new LessonError(at(location, 'steps'), 'expected a non-empty array');
  }
  const steps: LessonStep[] = [];
  for (const [index, step] of data.steps.entries()) {
    steps.push(await parseStep(step, at(location, `steps[${index}]`)));
  }
  return { id, steps };
}

async function parseStep(input: unknown, location: string): Promise<LessonStep> {
  const data = object(input, location);
  if (typeof data.text !== 'string' || data.text === '') {
    throw new LessonError(at(location, 'text'), 'expected a translation key');
  }
  const base: StepBase = {
    text: data.text,
    textVars: textVars(data.textVars, at(location, 'textVars')),
  };

  switch (data.type) {
    case StepType.Explain:
      return {
        ...base,
        type: StepType.Explain,
        keys: keyHints(data.keys ?? [], at(location, 'keys')),
        hand: data.hand === Hand.Left ? Hand.Left : Hand.Right,
        range: range(data.range, at(location, 'range')),
        staff: data.staff === undefined ? null : staffNotes(data.staff, at(location, 'staff')),
        music: data.music === undefined ? null : inlineScore(data.music, at(location, 'music')),
      };
    case StepType.Find: {
      if (!Array.isArray(data.notes) || data.notes.length === 0) {
        throw new LessonError(at(location, 'notes'), 'expected a non-empty array of notes');
      }
      return {
        ...base,
        type: StepType.Find,
        notes: data.notes.map((note, i) => pitch(note, at(location, `notes[${i}]`))),
        range: range(data.range, at(location, 'range')),
      };
    }
    case StepType.Exercise:
      return { ...base, type: StepType.Exercise, ...(await exercise(data, location)) };
    case StepType.Quiz: {
      if (!Array.isArray(data.notes) || data.notes.length === 0) {
        throw new LessonError(at(location, 'notes'), 'expected a non-empty array of notes');
      }
      const count = cardCount(data, location);
      const clef = data.clef ?? QuizClef.Auto;
      if (!isValueOf(QuizClef, clef)) {
        throw new LessonError(at(location, 'clef'), `expected ${describeValues(QuizClef)}`);
      }
      return {
        ...base,
        type: StepType.Quiz,
        notes: data.notes.map((note, i) => pitch(note, at(location, `notes[${i}]`))),
        count,
        clef,
        pass: passRule(data, location),
      };
    }
    case StepType.Rhythm:
      return { ...base, type: StepType.Rhythm, ...rhythm(data, location) };
    case StepType.WarmUp:
      return { ...base, type: StepType.WarmUp };
    case StepType.Match: {
      const within = data.within ?? null;
      if (
        within !== null &&
        (typeof within !== 'number' ||
          !Number.isInteger(within) ||
          within < 0 ||
          within > MATCH_WITHIN_MAX)
      ) {
        throw new LessonError(
          at(location, 'within'),
          `expected a whole number of semitones from 0 to ${MATCH_WITHIN_MAX}, or null`,
        );
      }
      return {
        ...base,
        type: StepType.Match,
        within,
        count: cardCount(data, location),
        pass: passRule(data, location),
      };
    }
    case StepType.Sing:
      return { ...base, type: StepType.Sing, ...sing(data, location) };
    default:
      throw new LessonError(at(location, 'type'), `expected ${describeValues(StepType)}`);
  }
}

function sing(
  data: Record<string, unknown>,
  location: string,
): Omit<SingStep, keyof StepBase | 'type'> {
  if (!isValueOf(SingMode, data.mode)) {
    throw new LessonError(at(location, 'mode'), `expected ${describeValues(SingMode)}`);
  }
  // A voice has no hands: notes are written without one.
  const input = object(data.score, at(location, 'score'));
  const notes = Array.isArray(input.notes)
    ? input.notes.map((note: unknown) =>
        note !== null && typeof note === 'object' ? { hand: Hand.Right, ...note } : note,
      )
    : input.notes;
  const score = inlineScore({ ...input, notes }, at(location, 'score'));
  if (score.form) {
    throw new LessonError(at(location, 'score › repeats'), 'a melody to sing has no repeats');
  }
  score.notes.slice(1).forEach((note, i) => {
    const before = score.notes[i]!;
    if (note.start < before.start + before.duration - 1e-9) {
      throw new LessonError(
        at(location, `score › notes[${i + 1}]`),
        'a melody to sing has one note at a time',
      );
    }
  });
  const view = data.view ?? ScoreView.Falling;
  if (!isValueOf(ScoreView, view)) {
    throw new LessonError(at(location, 'view'), `expected ${describeValues(ScoreView)}`);
  }
  const flag = (name: string, fallback: boolean): boolean => {
    const value = data[name] ?? fallback;
    if (typeof value !== 'boolean') {
      throw new LessonError(at(location, name), 'expected true or false');
    }
    return value;
  };
  return {
    mode: data.mode,
    score,
    view,
    notation: singNotation(data, location),
    strict: flag('strict', false),
    octave: flag('octave', false),
    guide: flag('guide', true),
    metronome: flag('metronome', false),
    pass: passRule(data, location),
  };
}

function singNotation(data: Record<string, unknown>, location: string): SheetNotation | null {
  const notation = data.notation ?? null;
  if (notation !== null && !SING_NOTATIONS.includes(notation as SheetNotation)) {
    throw new LessonError(
      at(location, 'notation'),
      `expected ${SING_NOTATIONS.map((value) => `"${value}"`).join(', ')}`,
    );
  }
  return notation as SheetNotation | null;
}

/** How many quiz cards or notes to match: 1–50, ten by default. */
function cardCount(data: Record<string, unknown>, location: string): number {
  const count = data.count ?? QUIZ_CARDS_DEFAULT;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 50) {
    throw new LessonError(at(location, 'count'), 'expected a whole number from 1 to 50');
  }
  return count;
}

function rhythm(
  data: Record<string, unknown>,
  location: string,
): Omit<RhythmStep, keyof StepBase | 'type'> {
  if (typeof data.pattern !== 'string') {
    throw new LessonError(at(location, 'pattern'), 'expected a rhythm such as "q q h | w"');
  }
  const timeSignature = data.timeSignature ?? [4, 4];
  let notes: { start: number; duration: number }[];
  try {
    notes = parseRhythm(data.pattern, timeSignature as [number, number]);
  } catch (error) {
    if (error instanceof RhythmError) throw new LessonError(at(location, 'pattern'), error.message);
    throw error;
  }
  let score: Score;
  try {
    score = parseInlineScore(
      {
        tempo: data.tempo,
        timeSignature,
        notes: notes.map((note) => ({ ...note, note: RHYTHM_NOTE, hand: Hand.Right })),
      },
      location,
    );
  } catch (error) {
    if (error instanceof ScoreError) throw new LessonError(error.location, error.message);
    throw error;
  }
  const view = data.view ?? ScoreView.Sheet;
  if (!isValueOf(ScoreView, view)) {
    throw new LessonError(at(location, 'view'), `expected ${describeValues(ScoreView)}`);
  }
  return {
    score,
    view,
    metronome: data.metronome !== false,
    pass: passRule(data, location),
  };
}

async function exercise(
  data: Record<string, unknown>,
  location: string,
): Promise<Omit<ExerciseStep, keyof StepBase | 'type'>> {
  if (!isValueOf(GradedMode, data.mode)) {
    throw new LessonError(at(location, 'mode'), `expected ${describeValues(GradedMode)}`);
  }
  const hands = data.hands ?? HandFilter.Both;
  if (!isValueOf(HandFilter, hands)) {
    throw new LessonError(at(location, 'hands'), `expected ${describeValues(HandFilter)}`);
  }

  let score: Score;
  let song: SongId | null = null;
  if (data.song !== undefined) {
    if (typeof data.song !== 'string' || !isSongId(data.song)) {
      throw new LessonError(at(location, 'song'), `unknown song "${String(data.song)}"`);
    }
    song = data.song;
    score = await loadSong(song);
  } else {
    score = inlineScore(data.score, at(location, 'score'));
  }
  if (data.tempo !== undefined) {
    if (typeof data.tempo !== 'number' || data.tempo <= 0) {
      throw new LessonError(at(location, 'tempo'), 'expected a positive number');
    }
    score = { ...score, tempo: data.tempo };
  }

  const view = data.view ?? ScoreView.Falling;
  if (!isValueOf(ScoreView, view)) {
    throw new LessonError(at(location, 'view'), `expected ${describeValues(ScoreView)}`);
  }

  const notation = data.notation ?? null;
  if (notation !== null && !isValueOf(SheetNotation, notation)) {
    throw new LessonError(at(location, 'notation'), `expected ${describeValues(SheetNotation)}`);
  }

  return {
    mode: data.mode,
    view,
    notation,
    hands,
    score,
    song,
    metronome: data.metronome === true,
    pass: {
      ...passRule(data, location),
      dynamics: passDynamics(data, score, location),
      touch: passTouch(data, score, location),
      pedal: passPedal(data, score, location),
    },
  };
}

function passTouch(data: Record<string, unknown>, score: Score, location: string): boolean {
  const pass = (data.pass ?? {}) as Record<string, unknown>;
  if (pass.touch === undefined) return false;
  if (typeof pass.touch !== 'boolean') {
    throw new LessonError(at(location, 'pass.touch'), 'expected true or false');
  }
  if (pass.touch && !hasTouchMarks(score)) {
    throw new LessonError(
      at(location, 'pass.touch'),
      'the score has no staccato, accents, tenuto or slurs',
    );
  }
  return pass.touch;
}

function passPedal(data: Record<string, unknown>, score: Score, location: string): boolean {
  const pass = object(data.pass ?? {}, at(location, 'pass'));
  if (pass.pedal === undefined) return false;
  if (typeof pass.pedal !== 'boolean') {
    throw new LessonError(at(location, 'pass › pedal'), 'expected true or false');
  }
  if (pass.pedal && !hasPedalMarks(score)) {
    throw new LessonError(at(location, 'pass › pedal'), 'the score has no pedal marks');
  }
  return pass.pedal;
}

function passDynamics(data: Record<string, unknown>, score: Score, location: string): boolean {
  const pass = object(data.pass ?? {}, at(location, 'pass'));
  if (pass.dynamics === undefined) return false;
  if (typeof pass.dynamics !== 'boolean') {
    throw new LessonError(at(location, 'pass › dynamics'), 'expected true or false');
  }
  if (pass.dynamics && !score.dynamics) {
    throw new LessonError(at(location, 'pass › dynamics'), 'the score has no dynamics');
  }
  return pass.dynamics;
}

function passRule(data: Record<string, unknown>, location: string): { minStars: number } {
  const pass = object(data.pass ?? {}, at(location, 'pass'));
  const minStars = pass.minStars ?? 0;
  if (![0, 1, 2, 3].includes(minStars as number)) {
    throw new LessonError(at(location, 'pass › minStars'), 'expected 0–3');
  }
  return { minStars: minStars as number };
}

function inlineScore(input: unknown, location: string): Score {
  try {
    return parseInlineScore(input, location);
  } catch (error) {
    if (error instanceof ScoreError) throw new LessonError(error.location, error.message);
    throw error;
  }
}

function staffNotes(input: unknown, location: string): StaffNotes {
  const data = object(input, location);
  if (!isValueOf(StaffClef, data.clef)) {
    throw new LessonError(at(location, 'clef'), `expected ${describeValues(StaffClef)}`);
  }
  if (!Array.isArray(data.notes) || data.notes.length === 0) {
    throw new LessonError(at(location, 'notes'), 'expected a non-empty array of notes');
  }
  return {
    clef: data.clef,
    notes: data.notes.map((note, i) => pitch(note, at(location, `notes[${i}]`))),
    names: data.names === true,
    bar: data.bar === true,
  };
}

/**
 * `"c": "C4"` names a note, `"cMajor": { "chord": "C4", "quality": "major" }` a chord, and
 * `"cScale": { "scale": "C4", "quality": "major" }` a scale.
 */
function textVars(input: unknown, location: string): Record<string, TextVar> {
  if (input === undefined) return {};
  const data = object(input, location);
  return Object.fromEntries(
    Object.entries(data).map(([name, value]) => [name, textVar(value, at(location, name))]),
  );
}

function textVar(input: unknown, location: string): TextVar {
  if (typeof input === 'string') return pitch(input, location);
  const data = object(input, location);
  if (data.chord !== undefined) {
    if (!isValueOf(ChordQuality, data.quality)) {
      throw new LessonError(at(location, 'quality'), `expected ${describeValues(ChordQuality)}`);
    }
    return { chord: pitch(data.chord, at(location, 'chord')), quality: data.quality };
  }
  if (data.scale !== undefined) {
    if (!isValueOf(ScaleQuality, data.quality)) {
      throw new LessonError(at(location, 'quality'), `expected ${describeValues(ScaleQuality)}`);
    }
    return { scale: pitch(data.scale, at(location, 'scale')), quality: data.quality };
  }
  throw new LessonError(location, 'expected a note, a chord or a scale');
}

function keyHints(input: unknown, location: string): KeyHint[] {
  if (!Array.isArray(input)) throw new LessonError(location, 'expected an array');
  return input.map((item, i) => {
    const data = object(item, at(location, `[${i}]`));
    const hint: KeyHint = { pitch: pitch(data.note, at(location, `[${i}] › note`)) };
    if (data.finger !== undefined) {
      if (![1, 2, 3, 4, 5].includes(data.finger as number)) {
        throw new LessonError(at(location, `[${i}] › finger`), 'expected 1–5');
      }
      hint.finger = data.finger as Finger;
    }
    if (data.hand !== undefined) {
      if (!isValueOf(Hand, data.hand)) {
        throw new LessonError(at(location, `[${i}] › hand`), `expected ${describeValues(Hand)}`);
      }
      hint.hand = data.hand;
    }
    return hint;
  });
}

function range(input: unknown, location: string): [number, number] | null {
  if (input === undefined) return null;
  if (!Array.isArray(input) || input.length !== 2) {
    throw new LessonError(location, 'expected [lowest, highest] notes');
  }
  const low = pitch(input[0], at(location, '[0]')).midi;
  const high = pitch(input[1], at(location, '[1]')).midi;
  if (low >= high) throw new LessonError(location, 'the lowest note must be below the highest');
  return [low, high];
}

function pitch(input: unknown, location: string): Pitch {
  if (typeof input !== 'string') throw new LessonError(location, 'expected a note such as "C4"');
  try {
    return parseNote(input);
  } catch (error) {
    if (error instanceof InvalidNoteError) throw new LessonError(location, error.message);
    throw error;
  }
}

function object(input: unknown, location: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new LessonError(location, 'expected an object');
  }
  return input as Record<string, unknown>;
}
