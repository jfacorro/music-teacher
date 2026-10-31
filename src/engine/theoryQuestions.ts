/**
 * Theory questions (PLAN.md milestones 7.1 and 7.3), about notes and the keys they're in: choosing
 * what something's called (`question` steps), or finding the notes it leads to (`build` steps), by
 * playing or singing. Cards are dealt so each answer and each starting note come up as evenly as
 * possible.
 */
import { IntervalName } from '../theory/chords';
import { intervalAbove, IntervalNumber, numberAbove } from '../theory/intervals';
import {
  FLATS,
  keyFifthsOf,
  keyNames,
  type KeyName,
  keyTonic,
  Mode,
  parseKey,
  scaleNotes,
  SHARPS,
} from '../theory/keys';
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
  /** The half or whole step between two neighboring notes of a scale. */
  ScaleStep: 'scaleStep',
  /** A note's place in the scale of a key. */
  ScaleDegree: 'scaleDegree',
  /** A major or a minor scale. */
  ScaleType: 'scaleType',
  /** Whether a melody ends on the key note. */
  HomeNote: 'homeNote',
  /** The major key of a key signature. */
  KeySignature: 'keySignature',
  /** The sharp or flat a key signature adds next. */
  NextAccidental: 'nextAccidental',
  /** The key one step clockwise on the circle of fifths: a fifth up. */
  CircleUp: 'circleUp',
  /** The key one step counterclockwise: a fifth down. */
  CircleDown: 'circleDown',
  RelativeMinor: 'relativeMinor',
  RelativeMajor: 'relativeMajor',
  /** The same degree of a note of C major, in another key. */
  TransposeNote: 'transposeNote',
  /** A short melody in C major, in another key. */
  TransposeMelody: 'transposeMelody',
} as const;
export type QuestionKind = (typeof QuestionKind)[keyof typeof QuestionKind];

export const StepSize = {
  Half: 'half',
  Whole: 'whole',
} as const;
export type StepSize = (typeof StepSize)[keyof typeof StepSize];

export const ScaleDegree = {
  First: 'degree1',
  Second: 'degree2',
  Third: 'degree3',
  Fourth: 'degree4',
  Fifth: 'degree5',
  Sixth: 'degree6',
  Seventh: 'degree7',
} as const;
export type ScaleDegree = (typeof ScaleDegree)[keyof typeof ScaleDegree];

const DEGREES: readonly ScaleDegree[] = Object.values(ScaleDegree);

export const Ending = {
  Home: 'home',
  Away: 'away',
} as const;
export type Ending = (typeof Ending)[keyof typeof Ending];

/** The answers about the distance between two notes, which read "Find a third above D". */
export type IntervalAnswer = StepSize | IntervalNumber | IntervalName;

export type QuestionAnswer = IntervalAnswer | ScaleDegree | Mode | Ending | KeyName;

/** How a `question` step shows its notes (they're always played too). */
export const QuestionShow = {
  Staff: 'staff',
  Keyboard: 'keyboard',
  /** Only played. */
  Ear: 'ear',
  /** On the circle of fifths, with the key it starts from marked. */
  Circle: 'circle',
} as const;
export type QuestionShow = (typeof QuestionShow)[keyof typeof QuestionShow];

const MAJOR_KEYS = keyNames(Mode.Major);

const ANSWERS: Readonly<Record<QuestionKind, readonly QuestionAnswer[]>> = {
  [QuestionKind.StepSize]: Object.values(StepSize),
  [QuestionKind.IntervalNumber]: Object.values(IntervalNumber),
  [QuestionKind.IntervalName]: Object.values(IntervalName),
  [QuestionKind.ScaleStep]: Object.values(StepSize),
  [QuestionKind.ScaleDegree]: DEGREES,
  [QuestionKind.ScaleType]: Object.values(Mode),
  [QuestionKind.HomeNote]: Object.values(Ending),
  [QuestionKind.KeySignature]: MAJOR_KEYS,
  [QuestionKind.NextAccidental]: [
    ...SHARPS.slice(1).map((step): KeyName => `${step}#`),
    ...FLATS.slice(1).map((step): KeyName => `${step}b`),
  ],
  [QuestionKind.CircleUp]: MAJOR_KEYS,
  [QuestionKind.CircleDown]: MAJOR_KEYS,
  [QuestionKind.RelativeMinor]: keyNames(Mode.Minor),
  [QuestionKind.RelativeMajor]: MAJOR_KEYS,
  [QuestionKind.TransposeNote]: DEGREES,
  [QuestionKind.TransposeMelody]: Object.values(Ending),
};

export const answersOf = (kind: QuestionKind): readonly QuestionAnswer[] => ANSWERS[kind];

/** The kinds a `build` step can't ask: there's nothing on the keys to find from a note given. */
export const NOT_BUILT: readonly QuestionKind[] = [
  QuestionKind.ScaleStep,
  QuestionKind.HomeNote,
  QuestionKind.KeySignature,
];
/** The kinds with nothing to show: they're only heard. */
export const ONLY_HEARD: readonly QuestionKind[] = [QuestionKind.HomeNote];
/** The kinds a `question` step can't ask: the answer is notes to find. */
export const NOT_ASKED: readonly QuestionKind[] = [
  QuestionKind.TransposeNote,
  QuestionKind.TransposeMelody,
];
/** The kinds whose answers name a key or a note, so they need no roots: each answer has its own. */
export const ANSWERS_ARE_ROOTS: readonly QuestionKind[] = [
  QuestionKind.KeySignature,
  QuestionKind.NextAccidental,
  QuestionKind.CircleUp,
  QuestionKind.CircleDown,
  QuestionKind.RelativeMinor,
  QuestionKind.RelativeMajor,
];

/** What a step can ask: the answers, and the notes or key notes its questions start from. */
export interface QuestionSet {
  kind: QuestionKind;
  answers: readonly QuestionAnswer[];
  /** Filled in from the answers for `ANSWERS_ARE_ROOTS`. */
  roots: readonly Pitch[];
  /** The scale asked about, for the kinds that ask about one. */
  mode: Mode;
}

/** The most answers shown at once. */
export const MAX_CHOICES = 4;

const STEP_SIZES: Readonly<Record<StepSize, number>> = {
  [StepSize.Half]: 1,
  [StepSize.Whole]: 2,
};

/**
 * The note an answer about a distance leads to above `root`.
 * @throws RangeError when it can't be spelled
 */
export function noteAbove(kind: QuestionKind, answer: IntervalAnswer, root: Pitch): Pitch {
  if (kind === QuestionKind.StepSize) {
    return pitchFromMidi(root.midi + STEP_SIZES[answer as StepSize]);
  }
  if (kind === QuestionKind.IntervalNumber) return numberAbove(root, answer as IntervalNumber);
  return intervalAbove(root, answer as IntervalName);
}

/** Notes heard one group after the other, each group together. */
export type Sound = readonly (readonly Pitch[])[];

export interface TheoryCard {
  answer: QuestionAnswer;
  /** The note given, or the key note. */
  root: Pitch;
  /** The notes asked about, as they're shown. */
  shown: readonly Pitch[];
  sound: Sound;
  /** The key signature it's written with. */
  keyFifths: number;
  /** What a `build` step asks to find, in this order, in any octave. */
  targets: readonly Pitch[];
  /** The scale degree it starts from or asks for, from 1; 0 when it isn't about one. */
  degree: number;
}

export interface TheoryQuestion extends TheoryCard {
  /** The answers offered, the right one among them, smallest first. */
  choices: QuestionAnswer[];
}

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)]!;

const moved = (pitch: Pitch, octaves: number) =>
  makePitch(pitch.step, pitch.alter, pitch.octave + octaves);

/** How many different notes a scale has. */
const SCALE_NOTES = 7;

/** A note of the scale by its place from the key note, which is 0; below it, it's negative. */
const scaleNote = (scale: readonly Pitch[], place: number): Pitch =>
  place < 0 ? moved(scale[place + SCALE_NOTES]!, -1) : scale[place]!;

const tonicChord = (scale: readonly Pitch[]): Pitch[] => [scale[0]!, scale[2]!, scale[4]!];

/** Short melodies by their places in the scale, ending on the key note or away from it. */
const MELODIES: Readonly<Record<Ending, readonly (readonly number[])[]>> = {
  [Ending.Home]: [
    [2, 1, 0],
    [4, 3, 2, 1, 0],
    [0, 2, 4, 7],
    [4, 2, 1, 0],
    [2, 3, 1, -1, 0],
  ],
  [Ending.Away]: [
    [0, 1, 2, 1],
    [2, 3, 4],
    [4, 3, 2, 1],
    [0, 2, 4, 5],
    [2, 1, 0, -1],
  ],
};

/** Transposing starts from here. */
export const TRANSPOSE_FROM = makePitch('C', 0, 4);

/**
 * The card for an answer from a root.
 * @throws RangeError when it can't be spelled
 */
export function cardFor(
  { kind, mode }: Pick<QuestionSet, 'kind' | 'mode'>,
  answer: QuestionAnswer,
  root: Pitch,
  random: () => number = Math.random,
): TheoryCard {
  switch (kind) {
    case QuestionKind.ScaleStep: {
      const scale = scaleNotes(root, mode);
      const size = STEP_SIZES[answer as StepSize];
      const place = pick(
        [...scale.keys()].filter(
          (i) => i < SCALE_NOTES && scale[i + 1]!.midi - scale[i]!.midi === size,
        ),
        random,
      );
      const notes = [scale[place]!, scale[place + 1]!];
      return {
        answer,
        root,
        shown: notes,
        sound: notes.map((note) => [note]),
        keyFifths: keyFifthsOf(root, mode),
        targets: notes.slice(1),
        degree: place + 1,
      };
    }
    case QuestionKind.ScaleDegree: {
      const scale = scaleNotes(root, mode);
      const place = DEGREES.indexOf(answer as ScaleDegree);
      const note = scale[place]!;
      return {
        answer,
        root,
        shown: [note],
        sound: [tonicChord(scale), [note]],
        keyFifths: keyFifthsOf(root, mode),
        targets: [note],
        degree: place + 1,
      };
    }
    case QuestionKind.ScaleType: {
      const scale = scaleNotes(root, answer as Mode);
      return {
        answer,
        root,
        shown: scale,
        sound: scale.map((note) => [note]),
        keyFifths: keyFifthsOf(root, answer as Mode),
        targets: scale.slice(1),
        degree: 0,
      };
    }
    case QuestionKind.HomeNote: {
      const scale = scaleNotes(root, mode);
      const melody = pick(MELODIES[answer as Ending], random);
      return {
        answer,
        root,
        shown: [],
        sound: [tonicChord(scale), ...melody.map((place) => [scaleNote(scale, place)])],
        keyFifths: keyFifthsOf(root, mode),
        targets: [],
        degree: 0,
      };
    }
    case QuestionKind.KeySignature: {
      const { tonic, mode: keyMode } = parseKey(answer as KeyName);
      return {
        answer,
        root: tonic,
        shown: [],
        sound: [tonicChord(scaleNotes(tonic, keyMode))],
        keyFifths: keyFifthsOf(tonic, keyMode),
        targets: [tonic],
        degree: 0,
      };
    }
    case QuestionKind.NextAccidental: {
      const { tonic: next } = parseKey(answer as KeyName);
      const sharp = next.alter > 0;
      const order = sharp ? SHARPS : FLATS;
      const place = order.indexOf(next.step);
      const last = makePitch(order[place - 1]!, next.alter, next.octave);
      return {
        answer,
        root: last,
        shown: [],
        sound: [[last]],
        keyFifths: sharp ? place : -place,
        targets: [
          intervalAbove(last, sharp ? IntervalName.PerfectFifth : IntervalName.PerfectFourth),
        ],
        degree: 0,
      };
    }
    case QuestionKind.CircleUp:
    case QuestionKind.CircleDown: {
      const { tonic: target } = parseKey(answer as KeyName);
      const fifths = keyFifthsOf(target, Mode.Major) + (kind === QuestionKind.CircleUp ? -1 : 1);
      const from = keyTonic(fifths, Mode.Major);
      return {
        answer,
        root: from,
        shown: [],
        sound: [[from]],
        keyFifths: fifths,
        targets: [target],
        degree: 0,
      };
    }
    case QuestionKind.RelativeMinor:
    case QuestionKind.RelativeMajor: {
      const { tonic: target, mode: targetMode } = parseKey(answer as KeyName);
      const fifths = keyFifthsOf(target, targetMode);
      const fromMode = targetMode === Mode.Major ? Mode.Minor : Mode.Major;
      const from = keyTonic(fifths, fromMode);
      return {
        answer,
        root: from,
        shown: [],
        sound: [tonicChord(scaleNotes(from, fromMode))],
        keyFifths: fifths,
        targets: [target],
        degree: 0,
      };
    }
    case QuestionKind.TransposeNote: {
      const place = DEGREES.indexOf(answer as ScaleDegree);
      return {
        answer,
        root,
        shown: [scaleNotes(TRANSPOSE_FROM, Mode.Major)[place]!],
        sound: [[root]],
        keyFifths: keyFifthsOf(root, Mode.Major),
        targets: [scaleNotes(root, Mode.Major)[place]!],
        degree: place + 1,
      };
    }
    case QuestionKind.TransposeMelody: {
      const melody = pick(MELODIES[answer as Ending], random);
      const inKey = (tonic: Pitch) => {
        const scale = scaleNotes(tonic, Mode.Major);
        return melody.map((place) => scaleNote(scale, place));
      };
      return {
        answer,
        root,
        shown: inKey(TRANSPOSE_FROM),
        sound: [[root]],
        keyFifths: keyFifthsOf(root, Mode.Major),
        targets: inKey(root),
        degree: 0,
      };
    }
    default: {
      const top = noteAbove(kind, answer as IntervalAnswer, root);
      return {
        answer,
        root,
        shown: [root, top],
        sound: [[root], [top]],
        keyFifths: 0,
        targets: [top],
        degree: 0,
      };
    }
  }
}

function cards(set: QuestionSet, count: number, random: () => number): TheoryCard[] {
  const dealtRoots = deal(set.roots, count, random);
  return deal(set.answers, count, random).map((answer, i) =>
    cardFor(set, answer, dealtRoots[i]!, random),
  );
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
  set: QuestionSet,
  count: number,
  random: () => number = Math.random,
): TheoryQuestion[] {
  return cards(set, count, random).map((card) => ({
    ...card,
    choices: choicesFor(set.answers, card.answer, random),
  }));
}

/** `count` things to find from the notes given, on the keyboard. */
export function buildCards(
  set: QuestionSet,
  count: number,
  random: () => number = Math.random,
): TheoryCard[] {
  return cards(set, count, random);
}

const allNotes = (card: TheoryCard): Pitch[] => [
  card.root,
  ...card.shown,
  ...card.sound.flat(),
  ...card.targets,
];

/** Moves a card by octaves into the range, as near the comfortable note as it can go. */
function inRange(
  card: TheoryCard,
  { low, high, comfortable }: { low: number; high: number; comfortable: number },
): TheoryCard {
  const midis = allNotes(card).map((note) => note.midi);
  const lowest = Math.min(...midis);
  const highest = Math.max(...midis);
  let best = 0;
  let bestCost = Infinity;
  for (let octaves = -4; octaves <= 4; octaves++) {
    const bottom = lowest + 12 * octaves;
    const top = highest + 12 * octaves;
    const outside = Math.max(0, low - bottom) + Math.max(0, top - high);
    const cost = outside * 100 + Math.abs((bottom + top) / 2 - comfortable);
    if (cost < bestCost) {
      best = octaves;
      bestCost = cost;
    }
  }
  const move = (notes: readonly Pitch[]) => notes.map((note) => moved(note, best));
  return {
    ...card,
    root: moved(card.root, best),
    shown: move(card.shown),
    sound: card.sound.map(move),
    targets: move(card.targets),
  };
}

/**
 * `count` things to find by singing, in the singer's range. Any octave counts when singing, so an
 * octave would be matched by the note given: it isn't asked.
 */
export function singCards(
  set: QuestionSet,
  count: number,
  range: { low: number; high: number; comfortable: number },
  random: () => number = Math.random,
): TheoryCard[] {
  const singable = set.answers.filter(
    (answer) => answer !== IntervalName.Octave && answer !== IntervalNumber.Eighth,
  );
  const asked = singable.length > 0 ? { ...set, answers: singable } : set;
  return cards(asked, count, random).map((card) => inRange(card, range));
}

/** A note to sing, and the note played before it: the one given, or the one just found. */
export interface SungNote {
  card: TheoryCard;
  note: Pitch;
  /** Its place in what the card asks for, from 0. */
  place: number;
  given: Pitch;
}

/** The most notes a sung step asks for: three scales would be 21. */
const MOST_SUNG_NOTES = 9;

/** The notes of `cards`, one at a time: as many whole cards as fit in `MOST_SUNG_NOTES`. */
export function sungNotes(cards: readonly TheoryCard[]): SungNote[] {
  const notes: SungNote[] = [];
  for (const card of cards) {
    if (notes.length + card.targets.length > MOST_SUNG_NOTES) break;
    card.targets.forEach((note, place) => {
      notes.push({ card, note, place, given: place === 0 ? card.root : card.targets[place - 1]! });
    });
  }
  return notes;
}

/** The keys that show all of `cards`, from a C to a C, so the keyboard stays put between them. */
export function keysFor(cards: readonly TheoryCard[]): [number, number] {
  const midis = cards.flatMap((card) => allNotes(card).map((note) => note.midi));
  return [12 * Math.floor(Math.min(...midis) / 12), 12 * Math.ceil(Math.max(...midis) / 12)];
}
