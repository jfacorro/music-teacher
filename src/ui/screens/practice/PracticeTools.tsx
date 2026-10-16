import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Score } from '../../../engine/score';
import { HandFilter, type LoopRange } from '../../../engine/session';
import { formatPercent } from '../../../i18n/format';
import { useInstrument, Instrument } from '../../../input/routing';

export const SPEED_MIN = 40;
export const SPEED_MAX = 100;
const SPEED_STEP = 5;

interface PracticeToolsProps {
  score: Score;
  /** Percent of the score's tempo. */
  speed: number;
  onSpeedChange: (speed: number) => void;
  loop: LoopRange;
  looping: boolean;
  onLoopChange: (loop: LoopRange, looping: boolean) => void;
  hands: HandFilter;
  otherHand: boolean;
  onOtherHandChange: (on: boolean) => void;
  /** Waiting (e.g. while a run plays back): shown dimmed, out of reach. */
  setAside?: boolean;
}

/** Speed, loop and the other hand (PLAN.md §2.3). */
export function PracticeTools({
  score,
  speed,
  onSpeedChange,
  loop,
  looping,
  onLoopChange,
  hands,
  otherHand,
  onOtherHandChange,
  setAside = false,
}: PracticeToolsProps) {
  const { t, i18n } = useTranslation('screens');
  const speedId = useId();
  const listening = useInstrument((s) => s.instrument === Instrument.Mic);
  const bars = score.measures.map((_, index) => index);

  const setFirst = (first: number) =>
    onLoopChange({ first, last: Math.max(first, loop.last) }, true);
  const setLast = (last: number) => onLoopChange({ first: Math.min(loop.first, last), last }, true);

  return (
    <div
      className={
        setAside
          ? 'practice__options practice__tools is-set-aside'
          : 'practice__options practice__tools'
      }
      inert={setAside}
    >
      <label className="inline-field" htmlFor={speedId}>
        {t('practice.speed')}
        <input
          id={speedId}
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={SPEED_STEP}
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
        />
        <output htmlFor={speedId} className="practice__speed">
          {t('practice.speedValue', {
            percent: formatPercent(speed / 100, i18n.language),
            bpm: Math.round((score.tempo * speed) / 100),
          })}
        </output>
      </label>

      <span className="inline-field">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={looping}
            onChange={(e) => onLoopChange(loop, e.target.checked)}
          />
          {t('practice.loop.label')}
        </label>
        <select
          aria-label={t('practice.loop.first')}
          value={loop.first}
          onChange={(e) => setFirst(Number(e.target.value))}
        >
          {bars.map((bar) => (
            <option key={bar} value={bar}>
              {bar + 1}
            </option>
          ))}
        </select>
        {t('practice.loop.to')}
        <select
          aria-label={t('practice.loop.last')}
          value={loop.last}
          onChange={(e) => setLast(Number(e.target.value))}
        >
          {bars.map((bar) => (
            <option key={bar} value={bar}>
              {bar + 1}
            </option>
          ))}
        </select>
      </span>

      {hands !== HandFilter.Both && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={otherHand}
            onChange={(e) => onOtherHandChange(e.target.checked)}
          />
          {t('practice.otherHand')}
        </label>
      )}

      {!looping && <span className="muted practice__tip">{t('practice.loop.tip')}</span>}
      {hands !== HandFilter.Both && otherHand && listening && (
        <span className="muted practice__tip">{t('practice.otherHandMic')}</span>
      )}
    </div>
  );
}
