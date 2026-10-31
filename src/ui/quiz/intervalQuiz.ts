/** What the theory quizzes share (PLAN.md milestones 7.1 and 7.3): their sound and their words. */
import { useTranslation } from 'react-i18next';
import { audioIfReady, soundLeadMs, startAudio } from '../../audio/audio';
import {
  ANSWERS_ARE_ROOTS,
  type ChordInversion,
  type IntervalAnswer,
  type Numeral,
  QuestionKind,
  type QuestionAnswer,
  type QuestionSet,
  type Sound,
  type TheoryCard,
  TRANSPOSE_FROM,
} from '../../engine/theoryQuestions';
import { useNoteNames } from '../../i18n/useNoteNames';
import { ignoreMicUntil } from '../../input/mic/micInput';
import { isValueOf } from '../../lib/values';
import { type ChordQuality, IntervalName } from '../../theory/chords';
import { type KeyName, Mode, parseKey } from '../../theory/keys';
import type { Pitch } from '../../theory/pitch';

/** How long each group of notes of a question sounds (ms). */
const NOTE_MS = 700;
/** The first note starts this long after asking, so it's never cut (ms). */
const START_DELAY_MS = 150;
/** How long the app's piano keeps ringing for the microphone after a question (ms). */
const RING_MS = 600;

/** Plays each group of notes together, one group after the other. */
export async function playSound(sound: Sound): Promise<void> {
  const engine = await startAudio().catch((error: unknown) => {
    console.warn('No audio', error);
    return null;
  });
  if (!engine) return;
  engine.stopAccompaniment();
  const start = performance.now() + START_DELAY_MS + soundLeadMs();
  sound.forEach((notes, i) => {
    for (const note of notes) {
      engine.accompany(note.midi, start + i * NOTE_MS, start + (i + 1) * NOTE_MS);
    }
  });
  ignoreMicUntil(start + sound.length * NOTE_MS + engine.outputDelayMs() + RING_MS);
}

export const stopNotes = () => audioIfReady()?.stopAccompaniment();

/** The kinds about the distance between two notes, which read "Find a third above D". */
const DISTANCES: readonly QuestionKind[] = [
  QuestionKind.StepSize,
  QuestionKind.IntervalNumber,
  QuestionKind.IntervalName,
];

/** The mode of the key a card is about: that of the key it starts from. */
function modeOf(kind: QuestionKind, mode: Mode, card: TheoryCard): Mode {
  if (kind === QuestionKind.ScaleType) return card.answer as Mode;
  if (kind === QuestionKind.RelativeMajor) return Mode.Minor;
  return ANSWERS_ARE_ROOTS.includes(kind) ? Mode.Major : mode;
}

/** How a card's words are found: a next sharp and a next flat read differently. */
function asking(kind: QuestionKind, card: TheoryCard) {
  if (kind !== QuestionKind.NextAccidental) return kind;
  return parseKey(card.answer as KeyName).tonic.alter > 0 ? 'nextSharp' : 'nextFlat';
}

const inversionOf = (card: TheoryCard) => card.answer as ChordInversion;

/** A card's words: what it asks, and the names of its answers. */
export function useCardWords({ kind, mode }: Pick<QuestionSet, 'kind' | 'mode'>) {
  const { t } = useTranslation('screens');
  const { t: tt } = useTranslation('theory');
  const names = useNoteNames();
  const name = (pitch: Pitch) => names.name(pitch, { octave: false });
  const keyName = (tonic: Pitch, keyMode: Mode) => tt(`chords.${keyMode}`, { root: name(tonic) });
  const chordName = (card: TheoryCard) =>
    tt(`chords.${kind === QuestionKind.ChordQuality ? (card.answer as ChordQuality) : mode}`, {
      root: name(card.root),
    });
  const found = (verb: 'play' | 'sing', card: TheoryCard, place: number) => {
    const doing = verb === 'play' ? 'playing' : 'singing';
    const note = name(card.root);
    if (DISTANCES.includes(kind)) {
      const what = tt(`find.${card.answer as IntervalAnswer}`);
      return t(`lesson.build.${verb}Prompt`, { what, note });
    }
    return t(`lesson.build.${doing}.${asking(kind, card) as Found}`, {
      key: keyName(card.root, modeOf(kind, mode, card)),
      chord: chordName(card),
      inversion: kind === QuestionKind.ChordInversion ? tt(`find.${inversionOf(card)}`) : '',
      numeral: kind === QuestionKind.RomanNumeral ? tt(`answers.${card.answer as Numeral}`) : '',
      note,
      degree: card.degree,
      place: place + 1,
      total: card.targets.length,
      notes: card.shown.map(name).join(', '),
      from: keyName(TRANSPOSE_FROM, Mode.Major),
    });
  };

  return {
    /** An answer's name on a button. */
    label: (answer: QuestionAnswer) => {
      if (kind === QuestionKind.NextAccidental) return name(parseKey(answer as KeyName).tonic);
      if (kind === QuestionKind.DominantOf) {
        return tt('chords.dominant7', { root: name(parseKey(answer as KeyName).tonic) });
      }
      if (ANSWERS_ARE_ROOTS.includes(kind)) {
        const { tonic, mode: keyMode } = parseKey(answer as KeyName);
        return keyName(tonic, keyMode);
      }
      const plain = answer as Exclude<QuestionAnswer, KeyName>;
      return isValueOf(IntervalName, plain) ? tt(`intervals.${plain}`) : tt(`answers.${plain}`);
    },
    /** The question over its answers. */
    question: (card: TheoryCard) =>
      t(`lesson.question.prompts.${asking(kind, card) as Asked}`, {
        key: keyName(card.root, modeOf(kind, mode, card)),
        from: card.degree,
        to: card.degree + 1,
      }),
    /** What to find on the keys. */
    play: (card: TheoryCard) => found('play', card, 0),
    /** What to sing: `place` is the note's place in what the card asks for, from 0. */
    sing: (card: TheoryCard, place: number) => found('sing', card, place),
  };
}

type Accidental = 'nextSharp' | 'nextFlat';
/** The kinds that have words of their own for what to find. */
type Found =
  | Accidental
  | Exclude<
      QuestionKind,
      | typeof QuestionKind.NextAccidental
      | typeof QuestionKind.StepSize
      | typeof QuestionKind.IntervalNumber
      | typeof QuestionKind.IntervalName
      | typeof QuestionKind.ScaleStep
      | typeof QuestionKind.HomeNote
      | typeof QuestionKind.KeySignature
      | typeof QuestionKind.Cadence
    >;
/** The kinds that are asked as questions. */
type Asked =
  | Accidental
  | Exclude<
      QuestionKind,
      | typeof QuestionKind.NextAccidental
      | typeof QuestionKind.TransposeNote
      | typeof QuestionKind.TransposeMelody
    >;
