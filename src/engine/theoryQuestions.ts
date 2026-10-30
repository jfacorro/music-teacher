/**
 * Theory questions (PLAN.md milestone 7.1), about the distance between two notes: choosing what
 * it's called (`question` steps), or finding the note it leads to (`build` steps), by playing or
 * singing. Cards are dealt so each answer and each starting note come up as evenly as possible.
 */
import { IntervalName } from '../theory/chords';
import { intervalAbove, IntervalNumber, numberAbove } from '../theory/intervals';
import { makePitch, type Pitch, pitchFromMidi } from '../theory/pitch';
import { deal } from './quiz';

/** What a question asks for. */
export const QuestionKind = {
  /** A half step or a whole step. */
  StepSize: 'stepSize',
  /** The interval's number, counting note names (no sharps or flats). */
  IntervalNumber: 'intervalNumber',
  /** The interval's full name: a major third. */
  IntervalName: 'intervalName',
} as const;
export type QuestionKind = (typeof QuestionKind)[keyof typeof QuestionKind];

export const StepSize = {
  Half: 'half',
  Whole: 'whole',
} as const;
export type StepSize = (typeof StepSize)[keyof typeof StepSize];

export type QuestionAnswer = StepSize | IntervalNumber | IntervalName;

/** How a `question` step shows its two notes (they're always played too). */
export const QuestionShow = {
  Staff: 'staff',
  Keyboard: 'keyboard',
  /** Only played. */
  Ear: 'ear',
} as const;
export type QuestionShow = (typeof QuestionShow)[keyof typeof QuestionShow];

const ANSWERS: Readonly<Record<QuestionKind, readonly QuestionAnswer[]>> = {
  [QuestionKind.StepSize]: Object.values(StepSize),
  [QuestionKind.IntervalNumber]: Object.values(IntervalNumber),
  [QuestionKind.IntervalName]: Object.values(IntervalName),
};

export const answersOf = (kind: QuestionKind): readonly QuestionAnswer[] => ANSWERS[kind];

/** What a step can ask: the answers, and the notes its questions start from. */
export interface IntervalSet {
  kind: QuestionKind;
  answers: readonly QuestionAnswer[];
  roots: readonly Pitch[];
}

/** The most answers shown at once. */
export const MAX_CHOICES = 4;

/**
 * The note an answer leads to above `root`.
 * @throws RangeError when it can't be spelled
 */
export function noteAbove(kind: QuestionKind, answer: QuestionAnswer, root: Pitch): Pitch {
  if (kind === QuestionKind.StepSize) {
    return pitchFromMidi(root.midi + (answer === StepSize.Half ? 1 : 2));
  }
  if (kind === QuestionKind.IntervalNumber) return numberAbove(root, answer as IntervalNumber);
  return intervalAbove(root, answer as IntervalName);
}

export interface IntervalCard {
  root: Pitch;
  top: Pitch;
  answer: QuestionAnswer;
}

export interface TheoryQuestion extends IntervalCard {
  /** The answers offered, the right one among them, smallest first. */
  choices: QuestionAnswer[];
}

function cards(
  { kind, answers, roots }: IntervalSet,
  count: number,
  random: () => number,
): IntervalCard[] {
  const dealtRoots = deal(roots, count, random);
  return deal(answers, count, random).map((answer, i) => {
    const root = dealtRoots[i]!;
    return { root, top: noteAbove(kind, answer, root), answer };
  });
}

function choicesFor(
  answers: readonly QuestionAnswer[],
  answer: QuestionAnswer,
  random: () => number,
): QuestionAnswer[] {
  if (answers.length <= MAX_CHOICES) return [...answers];
  const others = deal(
    answers.filter((other) => other !== answer),
    MAX_CHOICES - 1,
    random,
  );
  return answers.filter((other) => other === answer || others.includes(other));
}

/** `count` questions, each with up to `MAX_CHOICES` answers to choose from. */
export function theoryQuestions(
  set: IntervalSet,
  count: number,
  random: () => number = Math.random,
): TheoryQuestion[] {
  return cards(set, count, random).map((card) => ({
    ...card,
    choices: choicesFor(set.answers, card.answer, random),
  }));
}

/** `count` notes to find from the ones given, on the keyboard. */
export function buildCards(
  set: IntervalSet,
  count: number,
  random: () => number = Math.random,
): IntervalCard[] {
  return cards(set, count, random);
}

const moved = (pitch: Pitch, octaves: number) =>
  makePitch(pitch.step, pitch.alter, pitch.octave + octaves);

/** Moves a card by octaves into the range, as near the comfortable note as it can go. */
function inRange(
  card: IntervalCard,
  { low, high, comfortable }: { low: number; high: number; comfortable: number },
): IntervalCard {
  let best = 0;
  let bestCost = Infinity;
  for (let octaves = -4; octaves <= 4; octaves++) {
    const bottom = card.root.midi + 12 * octaves;
    const top = card.top.midi + 12 * octaves;
    const outside = Math.max(0, low - bottom) + Math.max(0, top - high);
    const cost = outside * 100 + Math.abs((bottom + top) / 2 - comfortable);
    if (cost < bestCost) {
      best = octaves;
      bestCost = cost;
    }
  }
  return { ...card, root: moved(card.root, best), top: moved(card.top, best) };
}

/**
 * `count` notes to find by singing, in the singer's range. Any octave counts when singing, so an
 * octave would be matched by the note given: it isn't asked.
 */
export function singCards(
  set: IntervalSet,
  count: number,
  range: { low: number; high: number; comfortable: number },
  random: () => number = Math.random,
): IntervalCard[] {
  const singable = set.answers.filter(
    (answer) => answer !== IntervalName.Octave && answer !== IntervalNumber.Eighth,
  );
  const asked = singable.length > 0 ? { ...set, answers: singable } : set;
  return cards(asked, count, random).map((card) => inRange(card, range));
}

/** The keys that show all of `cards`, from a C to a C, so the keyboard stays put between them. */
export function keysFor(cards: readonly IntervalCard[]): [number, number] {
  const midis = cards.flatMap((card) => [card.root.midi, card.top.midi]);
  return [12 * Math.floor(Math.min(...midis) / 12), 12 * Math.ceil(Math.max(...midis) / 12)];
}
