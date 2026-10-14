/**
 * Lesson format (PLAN.md §7). A lesson is a list of steps; its text lives in
 * `locales/<lang>/lessons/<id>.json` under `steps.<key>`, and note names in that text are
 * variables (`textVars`) filled in with the user's naming system.
 *
 * Step types:
 * - explain:  text, optionally with highlighted keys (and finger numbers)
 * - find:     press each of the given keys once, in any order
 * - exercise: a graded practice run (wait or tempo mode) of an inline score or a song
 * - quiz:     note-naming flash cards: a note on the staff, play its key
 * - rhythm:   tap any key along with a rhythm pattern (see engine/rhythm.ts)
 */
import { parseRhythm, RhythmError, RHYTHM_NOTE } from '../../engine/rhythm';
import type { Finger, Hand, Score } from '../../engine/score';
import type { HandFilter, PracticeMode } from '../../engine/session';
import { InvalidNoteError, parseNote, type Pitch } from '../../theory/pitch';
import { ScoreError, parseInlineScore } from '../loaders/inlineScore';
import { isSongId, loadSong, type SongId } from '../songs';

export interface KeyHint {
  pitch: Pitch;
  finger?: Finger;
}

interface StepBase {
  /** Translation key under `steps.` in the lesson's locale file. */
  text: string;
  textVars: Record<string, Pitch>;
}

/** The staves of a staff picture: treble, bass, or both (the grand staff). */
export type StaffClef = 'treble' | 'bass' | 'grand';

export interface StaffNotes {
  clef: StaffClef;
  notes: Pitch[];
  /** Write each note's name under it. */
  names: boolean;
}

export interface ExplainStep extends StepBase {
  type: 'explain';
  keys: KeyHint[];
  hand: Hand;
  range: [number, number] | null;
  /** Notes shown on a staff above the keyboard. */
  staff: StaffNotes | null;
}

export interface FindStep extends StepBase {
  type: 'find';
  notes: Pitch[];
  range: [number, number] | null;
}

/** How the music is shown: falling notes or sheet music. */
export type ScoreView = 'falling' | 'sheet';

/**
 * Sheet music levels (PLAN.md §2.2): note names under the notes; no names; both staves
 * (the full grand staff even when practicing one hand). The first two show only the staff of
 * the hand being practiced.
 */
export type SheetNotation = 'names' | 'plain' | 'grand';

export const SHEET_NOTATIONS: readonly SheetNotation[] = ['names', 'plain', 'grand'];

export interface ExerciseStep extends StepBase {
  type: 'exercise';
  /** The view the exercise starts in (the learner can switch). */
  view: ScoreView;
  /** The sheet music level it starts with; null = the learner's default (Settings). */
  notation: SheetNotation | null;
  mode: PracticeMode;
  hands: HandFilter;
  score: Score;
  /** The song this exercise plays, if any (for its title). */
  song: SongId | null;
  metronome: boolean;
  pass: { minStars: number };
}

/** The staff a quiz card is shown on; "auto": treble from middle C up, bass below. */
export type QuizClef = 'treble' | 'bass' | 'auto';

export interface QuizStep extends StepBase {
  type: 'quiz';
  /** The notes the cards are drawn from. */
  notes: Pitch[];
  /** How many cards. */
  count: number;
  clef: QuizClef;
  pass: { minStars: number };
}

export interface RhythmStep extends StepBase {
  type: 'rhythm';
  /** The pattern as a score: a note per tap, on the line of a one-line rhythm staff. */
  score: Score;
  view: ScoreView;
  metronome: boolean;
  pass: { minStars: number };
}

export const QUIZ_CARDS_DEFAULT = 10;

export type LessonStep = ExplainStep | FindStep | ExerciseStep | QuizStep | RhythmStep;

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
    case 'explain':
      return {
        ...base,
        type: 'explain',
        keys: keyHints(data.keys ?? [], at(location, 'keys')),
        hand: data.hand === 'L' ? 'L' : 'R',
        range: range(data.range, at(location, 'range')),
        staff: data.staff === undefined ? null : staffNotes(data.staff, at(location, 'staff')),
      };
    case 'find': {
      if (!Array.isArray(data.notes) || data.notes.length === 0) {
        throw new LessonError(at(location, 'notes'), 'expected a non-empty array of notes');
      }
      return {
        ...base,
        type: 'find',
        notes: data.notes.map((note, i) => pitch(note, at(location, `notes[${i}]`))),
        range: range(data.range, at(location, 'range')),
      };
    }
    case 'exercise':
      return { ...base, type: 'exercise', ...(await exercise(data, location)) };
    case 'quiz': {
      if (!Array.isArray(data.notes) || data.notes.length === 0) {
        throw new LessonError(at(location, 'notes'), 'expected a non-empty array of notes');
      }
      const count = data.count ?? QUIZ_CARDS_DEFAULT;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 50) {
        throw new LessonError(at(location, 'count'), 'expected a whole number from 1 to 50');
      }
      const clef = data.clef ?? 'auto';
      if (clef !== 'treble' && clef !== 'bass' && clef !== 'auto') {
        throw new LessonError(at(location, 'clef'), 'expected "treble", "bass" or "auto"');
      }
      return {
        ...base,
        type: 'quiz',
        notes: data.notes.map((note, i) => pitch(note, at(location, `notes[${i}]`))),
        count,
        clef,
        pass: passRule(data, location),
      };
    }
    case 'rhythm':
      return { ...base, type: 'rhythm', ...rhythm(data, location) };
    default:
      throw new LessonError(
        at(location, 'type'),
        'expected "explain", "find", "exercise", "quiz" or "rhythm"',
      );
  }
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
        notes: notes.map((note) => ({ ...note, note: RHYTHM_NOTE, hand: 'R' })),
      },
      location,
    );
  } catch (error) {
    if (error instanceof ScoreError) throw new LessonError(error.location, error.message);
    throw error;
  }
  const view = data.view ?? 'sheet';
  if (view !== 'falling' && view !== 'sheet') {
    throw new LessonError(at(location, 'view'), 'expected "falling" or "sheet"');
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
  if (data.mode !== 'wait' && data.mode !== 'tempo') {
    throw new LessonError(at(location, 'mode'), 'expected "wait" or "tempo"');
  }
  const hands = data.hands ?? 'both';
  if (hands !== 'both' && hands !== 'R' && hands !== 'L') {
    throw new LessonError(at(location, 'hands'), 'expected "both", "R" or "L"');
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
    try {
      score = parseInlineScore(data.score, at(location, 'score'));
    } catch (error) {
      if (error instanceof ScoreError) throw new LessonError(error.location, error.message);
      throw error;
    }
  }
  if (data.tempo !== undefined) {
    if (typeof data.tempo !== 'number' || data.tempo <= 0) {
      throw new LessonError(at(location, 'tempo'), 'expected a positive number');
    }
    score = { ...score, tempo: data.tempo };
  }

  const view = data.view ?? 'falling';
  if (view !== 'falling' && view !== 'sheet') {
    throw new LessonError(at(location, 'view'), 'expected "falling" or "sheet"');
  }

  const notation = data.notation ?? null;
  if (notation !== null && !SHEET_NOTATIONS.includes(notation as SheetNotation)) {
    throw new LessonError(at(location, 'notation'), 'expected "names", "plain" or "grand"');
  }

  return {
    mode: data.mode,
    view,
    notation: notation as SheetNotation | null,
    hands,
    score,
    song,
    metronome: data.metronome === true,
    pass: passRule(data, location),
  };
}

function passRule(data: Record<string, unknown>, location: string): { minStars: number } {
  const pass = object(data.pass ?? {}, at(location, 'pass'));
  const minStars = pass.minStars ?? 0;
  if (![0, 1, 2, 3].includes(minStars as number)) {
    throw new LessonError(at(location, 'pass › minStars'), 'expected 0–3');
  }
  return { minStars: minStars as number };
}

function staffNotes(input: unknown, location: string): StaffNotes {
  const data = object(input, location);
  if (data.clef !== 'treble' && data.clef !== 'bass' && data.clef !== 'grand') {
    throw new LessonError(at(location, 'clef'), 'expected "treble", "bass" or "grand"');
  }
  if (!Array.isArray(data.notes) || data.notes.length === 0) {
    throw new LessonError(at(location, 'notes'), 'expected a non-empty array of notes');
  }
  return {
    clef: data.clef,
    notes: data.notes.map((note, i) => pitch(note, at(location, `notes[${i}]`))),
    names: data.names === true,
  };
}

function textVars(input: unknown, location: string): Record<string, Pitch> {
  if (input === undefined) return {};
  const data = object(input, location);
  return Object.fromEntries(
    Object.entries(data).map(([name, note]) => [name, pitch(note, at(location, name))]),
  );
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
