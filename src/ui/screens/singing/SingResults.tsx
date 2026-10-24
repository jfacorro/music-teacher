import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteToWorkOn, SingSummary } from '../../../engine/singing';
import { IN_TUNE_CENTS } from '../../../engine/tuner';
import { formatPercent } from '../../../i18n/format';
import { Stars } from '../../components/Stars';

interface SingResultsProps {
  summary: SingSummary;
  /** A note's name, with its octave. */
  labelFor: (midi: number) => string;
  onRetry: () => void;
  /** More actions next to Try again (Listen, Compare, Continue in a lesson). */
  children?: ReactNode;
}

/**
 * How a sung melody went: stars and accuracy, how much was in tune, on time and steady, and the
 * notes to work on (flat or sharp, and by how much).
 */
export function SingResults({ summary, labelFor, onRetry, children }: SingResultsProps) {
  const { t, i18n } = useTranslation('screens');
  const percent = (value: number) => formatPercent(value, i18n.language);
  const how = (note: NoteToWorkOn) =>
    note.offset === null
      ? t('sing.results.notSung')
      : Math.abs(note.offset) <= IN_TUNE_CENTS
        ? t('sing.results.inTuneShare', { share: percent(note.inTune) })
        : t(note.offset > 0 ? 'tuner.sharp' : 'tuner.flat', { cents: Math.abs(note.offset) });

  return (
    <section className="results" aria-labelledby="sing-results">
      <h2 id="sing-results">{t('practice.results.heading')}</h2>
      <Stars stars={summary.stars} />
      <p className="results__accuracy">
        <span className="muted">{t('practice.results.accuracy')}</span>
        <strong>{percent(summary.accuracy)}</strong>
      </p>
      <dl className="results__counts">
        <div>
          <dt>{t('sing.results.inTune')}</dt>
          <dd>{percent(summary.inTune)}</dd>
        </div>
        {summary.onTime !== null && (
          <div>
            <dt>{t('sing.results.onTime')}</dt>
            <dd>{percent(summary.onTime)}</dd>
          </div>
        )}
        {summary.steady !== null && (
          <div>
            <dt>{t('sing.results.steady')}</dt>
            <dd>{percent(summary.steady)}</dd>
          </div>
        )}
      </dl>
      {summary.toWorkOn.length === 0 ? (
        <p>{t('tuner.match.allGood')}</p>
      ) : (
        <>
          <h3>{t('tuner.match.toWorkOn')}</h3>
          <ul className="match__work-on">
            {summary.toWorkOn.map((note) => (
              <li key={note.midi}>
                {t('tuner.match.workOn', { note: labelFor(note.midi), how: how(note) })}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="button-row results__actions">
        <button
          type="button"
          className={children ? 'button' : 'button button--primary'}
          title={t('sing.retryTip')}
          onClick={onRetry}
        >
          {t('practice.results.retry')}
        </button>
        {children}
      </div>
    </section>
  );
}
