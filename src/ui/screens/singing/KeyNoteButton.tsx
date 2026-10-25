import { useTranslation } from 'react-i18next';
import { soundLeadMs, startAudio } from '../../../audio/audio';
import type { Score } from '../../../engine/score';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { keyAlterOf, keyNoteNear, keyStepOf } from '../../../theory/keys';
import { ICONS } from '../../icons';

/** How long do sounds (ms), and how long after asking it starts, so it's never cut. */
const NOTE_MS = 1500;
const START_DELAY_MS = 150;

/**
 * Reading from the staff (PLAN.md milestone 6.5): plays the key note, so a melody can be found
 * without hearing it first.
 */
export function KeyNoteButton({ score }: { score: Score }) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const keyFifths = score.keyFifths ?? 0;
  const step = keyStepOf(keyFifths);
  const note = names.name(
    { step, alter: keyAlterOf(step, keyFifths), octave: 4 },
    { octave: false },
  );
  const play = async () => {
    const engine = await startAudio().catch((error: unknown) => {
      console.warn('No audio', error);
      return null;
    });
    if (!engine) return;
    const start = performance.now() + START_DELAY_MS + soundLeadMs();
    engine.accompany(
      keyNoteNear(
        keyFifths,
        score.notes.map((written) => written.pitch.midi),
      ),
      start,
      start + NOTE_MS,
    );
  };
  return (
    <button
      type="button"
      className="button"
      title={t('sing.keyNoteTip', { note })}
      onClick={() => void play()}
    >
      <span className="button__icon" aria-hidden="true">
        {ICONS.volume}
      </span>
      {t('sing.keyNote', { note })}
    </button>
  );
}
