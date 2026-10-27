import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STAR_THRESHOLDS } from '../../engine/scoring';
import { formatDate, formatPercent } from '../../i18n/format';

/** One try: when, and how it went (accuracy 0–1). */
export interface ChartRun {
  at: number;
  accuracy: number;
}

const WIDTH = 640;
const HEIGHT = 150;
const LEFT = 36;
const RIGHT = 40;
const TOP = 8;
const BOTTOM = 20;
/** Past this many tries, the points are left out: the line alone reads better. */
const MAX_POINTS = 60;
const DATE_AND_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
/** Which way a try's tooltip runs from its point: centered, or inwards near the edges. */
const TipSide = {
  Start: 'start',
  Middle: 'middle',
  End: 'end',
} as const;
type TipSide = (typeof TipSide)[keyof typeof TipSide];
/** Within this share of the width from an edge, the tooltip runs inwards. */
const TIP_EDGE = 0.2;

/**
 * The accuracy of every try, oldest first, as a line over the 1, 2 and 3-star levels (dashed);
 * a try's date and score show on hover.
 */
export function ProgressChart({ runs }: { runs: readonly ChartRun[] }) {
  const { t, i18n } = useTranslation('screens');
  const [hovered, setHovered] = useState<number | null>(null);
  if (runs.length === 0) return null;

  const percent = (value: number) => formatPercent(value, i18n.language);
  const step = runs.length > 1 ? (WIDTH - LEFT - RIGHT) / (runs.length - 1) : 0;
  const x = (i: number) => (runs.length > 1 ? LEFT + i * step : (LEFT + WIDTH - RIGHT) / 2);
  const y = (accuracy: number) => TOP + (1 - accuracy) * (HEIGHT - TOP - BOTTOM);
  const shown = hovered === null ? null : runs[hovered];
  const side: TipSide =
    hovered === null || (x(hovered) / WIDTH >= TIP_EDGE && x(hovered) / WIDTH <= 1 - TIP_EDGE)
      ? TipSide.Middle
      : x(hovered) / WIDTH < TIP_EDGE
        ? TipSide.Start
        : TipSide.End;

  return (
    <div className="progress-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={t('lesson.history.chartLabel', {
          count: runs.length,
          first: percent(runs[0]!.accuracy),
          last: percent(runs.at(-1)!.accuracy),
        })}
        onPointerLeave={() => setHovered(null)}
      >
        {[0, 0.5, 1].map((value) => (
          <text
            key={value}
            className="progress-chart__label"
            x={LEFT - 6}
            y={y(value) + 4}
            textAnchor="end"
          >
            {percent(value)}
          </text>
        ))}
        {STAR_THRESHOLDS.map((threshold, i) => (
          <g key={threshold}>
            <line
              className="progress-chart__level"
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(threshold)}
              y2={y(threshold)}
            />
            <text className="progress-chart__label" x={WIDTH - RIGHT + 6} y={y(threshold) + 4}>
              {'★'.repeat(i + 1)}
            </text>
          </g>
        ))}
        <line className="progress-chart__axis" x1={LEFT} x2={WIDTH - RIGHT} y1={y(0)} y2={y(0)} />
        {runs.length > 1 && (
          <polyline
            className="progress-chart__line"
            points={runs.map((run, i) => `${x(i)},${y(run.accuracy)}`).join(' ')}
          />
        )}
        {runs.map((run, i) =>
          runs.length <= MAX_POINTS || i === hovered ? (
            <circle
              key={run.at}
              className="progress-chart__point"
              cx={x(i)}
              cy={y(run.accuracy)}
              r={i === hovered ? 5 : 4}
            />
          ) : null,
        )}
        {/* Hover targets: a band around each try, wider than its point. */}
        {runs.map((run, i) => (
          <rect
            key={run.at}
            x={x(i) - Math.max(step, 12) / 2}
            y={0}
            width={Math.max(step, 12)}
            height={HEIGHT}
            fill="transparent"
            onPointerEnter={() => setHovered(i)}
          />
        ))}
        {[0, runs.length - 1].map((i) =>
          i === 0 && runs.length === 1 ? null : (
            <text
              key={i}
              className="progress-chart__label"
              x={x(i)}
              y={HEIGHT - 4}
              textAnchor={i === 0 ? 'start' : 'end'}
            >
              {t('lesson.history.tryNumber', { number: i + 1 })}
            </text>
          ),
        )}
      </svg>
      {shown && hovered !== null && (
        <span
          className={`progress-chart__tip progress-chart__tip--${side}`}
          role="tooltip"
          style={{
            left: `${(x(hovered) / WIDTH) * 100}%`,
            top: `${(y(shown.accuracy) / HEIGHT) * 100}%`,
          }}
        >
          {t('lesson.history.point', {
            number: hovered + 1,
            date: formatDate(new Date(shown.at), i18n.language, DATE_AND_TIME),
            score: percent(shown.accuracy),
          })}
        </span>
      )}
    </div>
  );
}
