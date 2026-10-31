/** What the theory quizzes share (PLAN.md milestones 7.1 and 7.3): their sound and their words. */
import { useTranslation } from 'react-i18next';
import { audioIfReady, soundLeadMs, startAudio } from '../../audio/audio';
import {
  type IntervalAnswer,
  QuestionKind,
  type QuestionAnswer,
  type QuestionSet,
  type Sound,
  type TheoryCard,
} from '../../engine/theoryQuestions';
import { useNoteNames } from '../../i18n/useNoteNames';
import { ignoreMicUntil } from '../../input/mic/micInput';
import { isValueOf } from '../../lib/values';
import { IntervalName } from '../../theory/chords';
import type { Mode } from '../../theory/keys';

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

/** An answer's name on a button. */
export function useAnswerNames() {
  const { t } = useTranslation('theory');
  return {
    label: (answer: QuestionAnswer) =>
      isValueOf(IntervalName, answer) ? t(`intervals.${answer}`) : t(`answers.${answer}`),
  };
}

/** What a card asks, in a sentence. */
export function useCardWords({ kind, mode }: Pick<QuestionSet, 'kind' | 'mode'>) {
  const { t } = useTranslation('screens');
  const { t: tt } = useTranslation('theory');
  const names = useNoteNames();
  const keyOf = (card: TheoryCard) =>
    tt(`chords.${kind === QuestionKind.ScaleType ? (card.answer as Mode) : mode}`, {
      root: names.name(card.root, { octave: false }),
    });
  const note = (card: TheoryCard) => names.name(card.root, { octave: false });
  const what = (card: TheoryCard) => tt(`find.${card.answer as IntervalAnswer}`);

  return {
    /** The question over its answers. */
    question: (card: TheoryCard) =>
      t(`lesson.question.prompts.${kind}`, {
        key: keyOf(card),
        from: card.degree,
        to: card.degree + 1,
      }),
    /** What to find on the keys. */
    play: (card: TheoryCard) => {
      if (kind === QuestionKind.ScaleDegree) {
        return t('lesson.build.playDegree', { degree: card.degree, key: keyOf(card) });
      }
      if (kind === QuestionKind.ScaleType) {
        return t('lesson.build.playScale', { key: keyOf(card) });
      }
      return t('lesson.build.playPrompt', { what: what(card), note: note(card) });
    },
    /** What to sing: `place` is the note's place in what the card asks for, from 0. */
    sing: (card: TheoryCard, place: number) => {
      if (kind === QuestionKind.ScaleDegree) {
        return t('lesson.build.singDegree', { degree: card.degree, key: keyOf(card) });
      }
      if (kind === QuestionKind.ScaleType) {
        return t('lesson.build.singScale', {
          key: keyOf(card),
          place: place + 1,
          total: card.targets.length,
        });
      }
      return t('lesson.build.singPrompt', { what: what(card), note: note(card) });
    },
  };
}
