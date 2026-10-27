import { useTranslation } from 'react-i18next';
import { formatDate, formatPercent } from '../../i18n/format';
import { dayOf } from '../../storage/db';
import { bestRun, type StepRun } from '../../storage/stepRuns';
import { ProgressChart } from './ProgressChart';
import { Stars } from './Stars';
import { StarsSize } from './starsSize';

/** Tries shown as a trend. */
const TREND = 5;
const DATE_AND_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
const DATE: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };

/** The try was today (its date isn't worth showing). */
const isToday = (at: number) => dayOf(at) === dayOf(Date.now());

/** A try's bar in the trend: its color says its stars (see styles.css). */
const barClass = (run: StepRun) => `step-history__bar step-history__bar--${run.stars}`;

/**
 * How a lesson step or a song went before: the best try and the last one, the last few as a
 * little trend (oldest first), and every try as a chart on request (a list for screen readers).
 * Nothing before the first try.
 */
export function RunHistory({
  runs,
  label,
}: {
  runs: readonly StepRun[] | undefined;
  label: string;
}) {
  const { t, i18n } = useTranslation('screens');
  const best = runs ? bestRun(runs) : null;
  const last = runs?.at(-1);
  if (!runs || !best || !last) return null;

  const percent = (run: StepRun) => formatPercent(run.accuracy, i18n.language);
  const when = (run: StepRun) => formatDate(new Date(run.at), i18n.language, DATE_AND_TIME);
  const recent = runs.slice(-TREND);
  const lastWasToday = isToday(last.at);

  return (
    <div className="step-history" aria-label={label}>
      <span className="step-history__item">
        <span className="muted">{t('lesson.history.best')}</span>
        <Stars stars={best.stars} size={StarsSize.Small} />
        {percent(best)}
      </span>
      <span className="step-history__item">
        <span className="muted">{t('lesson.history.last')}</span>
        <Stars stars={last.stars} size={StarsSize.Small} />
        {percent(last)}
        {!lastWasToday && (
          <span className="muted">{formatDate(new Date(last.at), i18n.language, DATE)}</span>
        )}
      </span>
      {recent.length > 1 && (
        <span
          className="step-history__trend"
          role="img"
          aria-label={t('lesson.history.trend', {
            count: recent.length,
            scores: recent.map(percent).join(', '),
          })}
        >
          {recent.map((run) => (
            <span
              key={run.at}
              className={barClass(run)}
              style={{ blockSize: `${Math.max(12, Math.round(run.accuracy * 100))}%` }}
              title={`${when(run)}: ${percent(run)}`}
            />
          ))}
        </span>
      )}
      <details className="step-history__all">
        <summary title={t('lesson.history.allTip')}>
          {t('lesson.history.tries', { count: runs.length })}
        </summary>
        <ProgressChart runs={runs} />
        <ol className="visually-hidden">
          {[...runs].reverse().map((run) => (
            <li key={run.at}>
              {when(run)}: {percent(run)}, {t('stars', { ns: 'common', stars: run.stars })}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
