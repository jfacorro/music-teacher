/** What the theory quizzes share (PLAN.md milestone 7.1): their sound and their words. */
import { useTranslation } from 'react-i18next';
import { audioIfReady, soundLeadMs, startAudio } from '../../audio/audio';
import type { QuestionAnswer } from '../../engine/theoryQuestions';
import { ignoreMicUntil } from '../../input/mic/micInput';
import { isValueOf } from '../../lib/values';
import { IntervalName } from '../../theory/chords';

/** How long each note of a question sounds (ms). */
const NOTE_MS = 700;
/** The first note starts this long after asking, so it's never cut (ms). */
const START_DELAY_MS = 150;
/** How long the app's piano keeps ringing for the microphone after a question (ms). */
const RING_MS = 600;

/** Plays notes one after the other. */
export async function playNotes(midis: readonly number[]): Promise<void> {
  const engine = await startAudio().catch((error: unknown) => {
    console.warn('No audio', error);
    return null;
  });
  if (!engine) return;
  engine.stopAccompaniment();
  const start = performance.now() + START_DELAY_MS + soundLeadMs();
  midis.forEach((midi, i) => {
    engine.accompany(midi, start + i * NOTE_MS, start + (i + 1) * NOTE_MS);
  });
  ignoreMicUntil(start + midis.length * NOTE_MS + engine.outputDelayMs() + RING_MS);
}

export const stopNotes = () => audioIfReady()?.stopAccompaniment();

/** An answer's name on a button, and in a sentence ("a major third"). */
export function useAnswerNames() {
  const { t } = useTranslation('theory');
  return {
    label: (answer: QuestionAnswer) =>
      isValueOf(IntervalName, answer) ? t(`intervals.${answer}`) : t(`answers.${answer}`),
    phrase: (answer: QuestionAnswer) => t(`find.${answer}`),
  };
}
