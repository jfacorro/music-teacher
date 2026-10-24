import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { audioIfReady, soundLeadMs, startAudio } from '../../../../audio/audio';
import type { WarmUpStep } from '../../../../content/lessons';
import {
  WARM_UP_NOTE_MS,
  WARM_UP_PATTERN,
  warmUpDuration,
  warmUpNotes,
  warmUpRoots,
} from '../../../../engine/warmUp';
import { useNoteNames } from '../../../../i18n/useNoteNames';
import { useSettings } from '../../../../storage/settings';
import { pitchFromMidi } from '../../../../theory/pitch';
import { ICONS } from '../../../icons';

/** How long the comfortable note is played to hum along with (ms). */
const HUM_MS = 2500;
/** Sound starts this long after the click, so it's never cut (ms). */
const START_DELAY_MS = 150;

/** Where the pattern is: the app playing it, or the singer's turn. */
const Turn = {
  Listen: 'listen',
  Sing: 'sing',
} as const;
type Turn = (typeof Turn)[keyof typeof Turn];

/**
 * The vocal warm-up that starts each voice lesson: breathing, humming the comfortable note, a
 * siren, and a five-note pattern from the range that the app plays and the singer sings back.
 * Not graded: Continue is always there.
 */
export function WarmUpStepView({ text }: { step: WarmUpStep; text: string }) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const range = useSettings((s) => s.vocalRange);
  const roots = useMemo(() => (range ? warmUpRoots(range) : []), [range]);
  /** When the pattern started (performance.now() ms, sound included), while it plays. */
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [turn, setTurn] = useState<Turn>(Turn.Listen);
  const ticker = useRef<ReturnType<typeof setInterval>>(undefined);

  const stop = () => {
    clearInterval(ticker.current);
    audioIfReady()?.stopAccompaniment();
    setStartedAt(null);
  };
  useEffect(
    () => () => {
      clearInterval(ticker.current);
      audioIfReady()?.stopAccompaniment();
    },
    [],
  );

  const engine = () =>
    startAudio().catch((error: unknown) => {
      console.warn('No audio', error);
      return null;
    });

  const hum = async () => {
    if (!range) return;
    const audio = await engine();
    if (!audio) return;
    stop();
    const start = performance.now() + START_DELAY_MS + soundLeadMs();
    audio.accompany(range.comfortable, start, start + HUM_MS);
  };

  const play = async () => {
    const audio = await engine();
    if (!audio) return;
    stop();
    const start = performance.now() + START_DELAY_MS + soundLeadMs();
    for (const note of warmUpNotes(roots)) {
      audio.accompany(note.midi, start + note.start, start + note.end);
    }
    const heardAt = start + audio.outputDelayMs();
    const end = heardAt + warmUpDuration(roots);
    const turnMs = WARM_UP_PATTERN.length * WARM_UP_NOTE_MS;
    setStartedAt(heardAt);
    setTurn(Turn.Listen);
    ticker.current = setInterval(() => {
      const now = performance.now();
      if (now >= end) {
        stop();
        return;
      }
      setTurn(Math.floor(Math.max(0, now - heardAt) / turnMs) % 2 === 0 ? Turn.Listen : Turn.Sing);
    }, 100);
  };

  if (!range) {
    return (
      <div className="lesson__step">
        <p className="lesson__text">{text}</p>
        <p className="muted">
          {t('lesson.warmUp.noRange')} <Link to="/settings#voice">{t('tuner.findRange')}</Link>
        </p>
      </div>
    );
  }

  const comfortable = names.name(pitchFromMidi(range.comfortable), { octave: true });
  const playing = startedAt !== null;

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <ol className="warm-up">
        <li>{t('lesson.warmUp.breathe')}</li>
        <li>
          <p>{t('lesson.warmUp.hum', { note: comfortable })}</p>
          <div className="button-row">
            <button type="button" className="button" onClick={() => void hum()}>
              <span className="button__icon" aria-hidden="true">
                {ICONS.volume}
              </span>
              {t('lesson.warmUp.playNote', { note: comfortable })}
            </button>
          </div>
        </li>
        <li>{t('lesson.warmUp.siren')}</li>
        <li>
          <p>{t('lesson.warmUp.pattern')}</p>
          <div className="button-row">
            {playing ? (
              <button type="button" className="button" onClick={stop}>
                <span className="button__icon" aria-hidden="true">
                  {ICONS.stop}
                </span>
                {t('lesson.warmUp.stop')}
              </button>
            ) : (
              <button type="button" className="button" onClick={() => void play()}>
                <span className="button__icon" aria-hidden="true">
                  {ICONS.play}
                </span>
                {t('lesson.warmUp.play')}
              </button>
            )}
            {playing && (
              <span className="warm-up__turn" role="status">
                {turn === Turn.Listen ? t('lesson.warmUp.listen') : t('lesson.warmUp.singBack')}
              </span>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}
