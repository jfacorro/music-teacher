import { useTranslation } from 'react-i18next';
import { soundLeadMs, startAudio } from '../../../audio/audio';
import type { Score } from '../../../engine/score';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { keyAlterOf, keyNoteNear, keyStepOf } from '../../../theory/solfa';
import { ICONS } from '../../icons';

/** How long do sounds (ms), and how long after asking it starts, so it's never cut. */
const NOTE_MS = 1500;
const START_DELAY_MS = 150;

/**
 * Reading from the staff (PLAN.md milestone 6.5): plays do, the key note, so a melody can be
 * found without hearing it first.
 */
export function KeyNoteButton({ score }: { score: Score }) {
  const { t } = useTranslation('screens');
  const play = async () => {
    const engine = await startAudio().catch((error: unknown) => {
      console.warn('No audio', error);
      return null;
    });
    if (!engine) return;
    const start = performance.now() + START_DELAY_MS + soundLeadMs();
    engine.accompany(
      keyNoteNear(
        score.keyFifths ?? 0,
        score.notes.map((note) => note.pitch.midi),
      ),
      start,
      start + NOTE_MS,
    );
  };
  return (
    <button
      type="button"
      className="button"
      title={t('sing.keyNoteTip')}
      onClick={() => void play()}
    >
      <span className="button__icon" aria-hidden="true">
        {ICONS.volume}
      </span>
      {t('sing.keyNote')}
    </button>
  );
}

/**
 * Under do, re, mi: the melody was moved into the singer's range, so do is wherever its key note
 * landed (named in the user's note names).
 */
export function MovableDoNote({ score }: { score: Score }) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const keyFifths = score.keyFifths ?? 0;
  const step = keyStepOf(keyFifths);
  const note = names.name(
    { step, alter: keyAlterOf(step, keyFifths), octave: 4 },
    { octave: false },
  );
  return <p className="muted">{t('sing.movableDo', { note })}</p>;
}
