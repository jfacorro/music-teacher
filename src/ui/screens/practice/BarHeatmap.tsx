import { useTranslation } from 'react-i18next';
import { STAR_THRESHOLDS, type Tally } from '../../../engine/scoring';
import { formatPercent } from '../../../i18n/format';

/** 0–3 like the stars, or "empty" for a bar without notes. */
const heatOf = (bar: Tally) =>
  bar.expected === 0 && bar.wrong === 0
    ? 'empty'
    : String(STAR_THRESHOLDS.filter((threshold) => bar.accuracy >= threshold - 1e-9).length);

interface BarHeatmapProps {
  measures: readonly Tally[];
  /** Makes each bar a button that repeats it (bar index from 0). */
  onSelect?: (bar: number) => void;
}

/** How each bar went (PLAN.md §2.4), colored like the stars it would earn. */
export function BarHeatmap({ measures, onSelect }: BarHeatmapProps) {
  const { t, i18n } = useTranslation('screens');
  const label = (bar: Tally, index: number) =>
    heatOf(bar) === 'empty'
      ? t('practice.results.bars.empty', { bar: index + 1 })
      : t('practice.results.bars.bar', {
          bar: index + 1,
          accuracy: formatPercent(bar.accuracy, i18n.language),
        });

  return (
    <section className="bars" aria-labelledby="bars-heading">
      <h3 id="bars-heading">{t('practice.results.bars.heading')}</h3>
      <ol className="bars__list">
        {measures.map((bar, index) => {
          const className = `bars__bar bars__bar--${heatOf(bar)}`;
          return (
            <li key={index}>
              {onSelect && heatOf(bar) !== 'empty' ? (
                <button
                  type="button"
                  className={className}
                  title={label(bar, index)}
                  aria-label={label(bar, index)}
                  onClick={() => onSelect(index)}
                >
                  {index + 1}
                </button>
              ) : (
                <span
                  className={className}
                  title={label(bar, index)}
                  aria-label={label(bar, index)}
                >
                  {index + 1}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {onSelect && <p className="muted bars__hint">{t('practice.results.bars.hint')}</p>}
    </section>
  );
}
