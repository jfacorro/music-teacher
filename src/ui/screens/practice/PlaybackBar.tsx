import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { beatsToMs } from '../../../engine/score';
import type { Transport } from '../../../engine/transport';
import { useAnimationFrame } from '../../hooks';
import { ICONS } from '../../icons';

/** Redraw when the position moved this much (beats), not every frame. */
const STEP_BEATS = 0.05;

interface PlaybackBarProps {
  transport: Transport;
  /** The stretch played back, beats. */
  from: number;
  to: number;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

/** "m:ss" */
function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Stands in for the practice controls while a run is played back (PLAN.md milestone 4.2): what
 * is going on, how far along it is, pausing, and the way out.
 */
export function PlaybackBar({
  transport,
  from,
  to,
  paused,
  onPause,
  onResume,
  onStop,
}: PlaybackBarProps) {
  const { t } = useTranslation('screens');
  const [beat, setBeat] = useState(from);
  useAnimationFrame(() => {
    const now = transport.position();
    if (Math.abs(now - beat) >= STEP_BEATS) setBeat(now);
  });

  const share = Math.min(1, Math.max(0, (beat - from) / (to - from)));
  const percent = Math.round(share * 100);
  return (
    <div className="playback">
      <span className="playback__label">
        <span aria-hidden="true">{ICONS.listen}</span>
        {paused ? t('practice.recording.paused') : t('practice.recording.playing')}
      </span>
      <div
        className="playback__track"
        role="progressbar"
        aria-label={t('practice.recording.position')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="playback__fill" style={{ inlineSize: `${share * 100}%` }} />
      </div>
      <span className="playback__time">
        {t('practice.recording.time', {
          elapsed: clock(beatsToMs(beat - from, transport.tempo)),
          total: clock(beatsToMs(to - from, transport.tempo)),
        })}
      </span>
      <button
        type="button"
        className="button"
        onClick={paused ? onResume : onPause}
        aria-keyshortcuts="Space"
        title={t('practice.tips.withKey', {
          action: paused ? t('practice.recording.resume') : t('practice.recording.pause'),
          key: t('practice.keys.space'),
        })}
      >
        <span className="button__icon" aria-hidden="true">
          {paused ? ICONS.play : ICONS.pause}
        </span>
        {paused ? t('practice.recording.resume') : t('practice.recording.pause')}
      </button>
      <button
        type="button"
        className="button"
        onClick={onStop}
        aria-keyshortcuts="Escape"
        title={t('practice.tips.withKey', {
          action: t('practice.recording.stopTip'),
          key: t('practice.keys.escape'),
        })}
      >
        <span className="button__icon" aria-hidden="true">
          {ICONS.stop}
        </span>
        {t('practice.recording.stop')}
      </button>
    </div>
  );
}
