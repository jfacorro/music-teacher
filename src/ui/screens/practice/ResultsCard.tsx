import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Summary } from '../../../engine/scoring';
import { PracticeMode } from '../../../engine/session';
import { formatPercent } from '../../../i18n/format';
import { Stars } from '../../components/Stars';
import { ICONS } from '../../icons';
import { BarHeatmap } from './BarHeatmap';
import { DynamicsBreakdown } from './DynamicsBreakdown';
import { TouchBreakdown } from './TouchBreakdown';
import { TimingBreakdown } from './TimingBreakdown';

interface ResultsCardProps {
  summary: Summary;
  mode: PracticeMode;
  onRetry: () => void;
  /** A rhythm exercise: wrong keys are extra taps. */
  rhythm?: boolean;
  /** Lets a bar of the heatmap be clicked to repeat it (index from 0). */
  onSelectBar?: (bar: number) => void;
  /** The music has loud and soft parts (graded only on a MIDI keyboard). */
  hasDynamics?: boolean;
  /** The music has staccato, slurs, accents or tenuto (graded only on a MIDI keyboard). */
  hasTouch?: boolean;
  /** Extra actions next to Try again. */
  children?: ReactNode;
}

export function ResultsCard({
  summary,
  mode,
  rhythm = false,
  onRetry,
  onSelectBar,
  hasDynamics = false,
  hasTouch = false,
  children,
}: ResultsCardProps) {
  const { t, i18n } = useTranslation('screens');

  const counts =
    mode === PracticeMode.Tempo
      ? (['perfect', 'good', 'ok', 'missed', 'wrong'] as const)
      : (['correct', 'wrong'] as const);

  return (
    <section className="results" aria-labelledby="results-heading">
      <h2 id="results-heading">{t('practice.results.heading')}</h2>
      <Stars stars={summary.stars} />
      <p className="results__accuracy">
        <span className="muted">{t('practice.results.accuracy')}</span>
        <strong>{formatPercent(summary.accuracy, i18n.language)}</strong>
      </p>
      {summary.hands && (
        <p className="results__hands">
          {summary.hands.map(({ hand, tally }) => (
            <span key={hand}>
              <span aria-hidden="true">{ICONS[hand]}</span>{' '}
              {t('practice.results.hand', {
                hand: t(`practice.hands.${hand}`),
                accuracy: formatPercent(tally.accuracy, i18n.language),
              })}
            </span>
          ))}
        </p>
      )}
      <dl className="results__counts">
        {counts.map((key) => (
          <div key={key}>
            <dt>{t(`practice.results.${key === 'wrong' && rhythm ? 'extra' : key}`)}</dt>
            <dd>{summary[key]}</dd>
          </div>
        ))}
      </dl>
      {summary.timing && summary.timing.errorsMs.length > 0 && (
        <TimingBreakdown timing={summary.timing} />
      )}
      {summary.dynamics ? (
        <DynamicsBreakdown dynamics={summary.dynamics} />
      ) : (
        hasDynamics && <p className="muted">{t('practice.dynamics.midiOnly')}</p>
      )}
      {summary.touch ? (
        <TouchBreakdown touch={summary.touch} />
      ) : (
        hasTouch && <p className="muted">{t('practice.touch.midiOnly')}</p>
      )}
      {summary.measures.length > 1 && (
        <BarHeatmap measures={summary.measures} onSelect={onSelectBar} />
      )}
      <div className="button-row results__actions">
        <button
          type="button"
          className={children ? 'button' : 'button button--primary'}
          title={t('practice.tips.retry')}
          onClick={onRetry}
        >
          {t('practice.results.retry')}
        </button>
        {children}
      </div>
    </section>
  );
}
