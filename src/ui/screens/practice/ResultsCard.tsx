import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Summary } from '../../../engine/scoring';
import type { PracticeMode } from '../../../engine/session';
import { formatPercent } from '../../../i18n/format';

const STAR = '★';
const EMPTY_STAR = '☆';

interface ResultsCardProps {
  summary: Summary;
  mode: PracticeMode;
  onRetry: () => void;
  /** Extra actions next to Try again. */
  children?: ReactNode;
}

export function ResultsCard({ summary, mode, onRetry, children }: ResultsCardProps) {
  const { t, i18n } = useTranslation('screens');

  const counts =
    mode === 'tempo'
      ? (['perfect', 'good', 'ok', 'missed', 'wrong'] as const)
      : (['correct', 'wrong'] as const);

  return (
    <section className="results" aria-labelledby="results-heading">
      <h2 id="results-heading">{t('practice.results.heading')}</h2>
      <p
        className="results__stars"
        aria-label={t('practice.results.stars', { stars: summary.stars })}
      >
        {STAR.repeat(summary.stars) + EMPTY_STAR.repeat(3 - summary.stars)}
      </p>
      <p className="results__accuracy">
        <span className="muted">{t('practice.results.accuracy')}</span>
        <strong>{formatPercent(summary.accuracy, i18n.language)}</strong>
      </p>
      <dl className="results__counts">
        {counts.map((key) => (
          <div key={key}>
            <dt>{t(`practice.results.${key}`)}</dt>
            <dd>{summary[key]}</dd>
          </div>
        ))}
      </dl>
      <div className="button-row results__actions">
        <button
          type="button"
          className={children ? 'button' : 'button button--primary'}
          onClick={onRetry}
        >
          {t('practice.results.retry')}
        </button>
        {children}
      </div>
    </section>
  );
}
