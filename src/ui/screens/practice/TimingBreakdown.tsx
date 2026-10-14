import { useTranslation } from 'react-i18next';
import type { TimingSummary } from '../../../engine/scoring';

const WIDTH = 300;
const HEIGHT = 40;
const MARGIN = 6;
/** Averages this close to the beat read as "right on the beat". */
const ON_BEAT_MS = 10;
/** The grading windows, widest first so the narrower ones are drawn on top. */
const ZONES = ['ok', 'good', 'perfect'] as const;

/**
 * Where each note landed in time (PLAN.md §2.4): a dot per note on a line from early to late,
 * over the perfect / good / OK windows, with counts and the average.
 */
export function TimingBreakdown({ timing }: { timing: TimingSummary }) {
  const { t } = useTranslation('screens');
  const { windows, errorsMs } = timing;
  const x = (ms: number) =>
    WIDTH / 2 +
    (Math.max(-windows.ok, Math.min(windows.ok, ms)) / windows.ok) * (WIDTH / 2 - MARGIN);
  const mean = Math.round(timing.meanMs);
  const direction = Math.abs(mean) <= ON_BEAT_MS ? 'onBeat' : mean < 0 ? 'early' : 'late';

  return (
    <section className="timing" aria-labelledby="timing-heading">
      <h3 id="timing-heading">{t('practice.results.timing.heading')}</h3>
      <svg
        className="timing__chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={t('practice.results.timing.chart', {
          early: timing.early,
          onTime: timing.onTime,
          late: timing.late,
        })}
      >
        {ZONES.map((zone) => (
          <rect
            key={zone}
            className={`timing__zone timing__zone--${zone}`}
            x={x(-windows[zone])}
            y={0}
            width={x(windows[zone]) - x(-windows[zone])}
            height={HEIGHT}
          />
        ))}
        <line className="timing__beat" x1={WIDTH / 2} x2={WIDTH / 2} y1={0} y2={HEIGHT} />
        {errorsMs.map((ms, index) => (
          <circle
            key={index}
            className="timing__dot"
            cx={x(ms)}
            // Spread the dots up and down a little so they don't hide each other.
            cy={HEIGHT / 2 + (((index * 3) % 5) - 2) * 6}
            r={3.5}
          />
        ))}
      </svg>
      <div className="timing__counts">
        <span>{t('practice.results.timing.early', { count: timing.early })}</span>
        <span>{t('practice.results.timing.onTime', { count: timing.onTime })}</span>
        <span>{t('practice.results.timing.late', { count: timing.late })}</span>
      </div>
      <p className="muted timing__average">
        {t('practice.results.timing.average', { direction, ms: Math.abs(mean) })}
      </p>
    </section>
  );
}
