import { useTranslation } from 'react-i18next';
import { PASS_SHARE, type TouchSummary } from '../../../engine/touch';

const CHECK = '✓';
const CROSS = '✗';

/** Results: how each kind of touch went (staccato short, slurs connected…), and where. */
export function TouchBreakdown({ touch }: { touch: TouchSummary }) {
  const { t } = useTranslation('screens');
  return (
    <section className="touch-results">
      <h3>{t('practice.touch.heading')}</h3>
      <ul className="touch-results__list">
        {touch.kinds.map(({ kind, right, total }) => {
          const ok = right / total >= PASS_SHARE - 1e-9;
          return (
            <li key={kind} className="touch-results__item">
              <span className="touch-results__kind">{t(`practice.touch.kinds.${kind}`)}</span>
              <span>{t(`practice.touch.counts.${kind}`, { right, total })}</span>
              <span
                className={ok ? 'touch-results__verdict is-ok' : 'touch-results__verdict'}
                aria-hidden="true"
              >
                {ok ? CHECK : CROSS}
              </span>
            </li>
          );
        })}
      </ul>
      {touch.bars.length > 0 && (
        <p className="muted">
          {t('practice.touch.bars', {
            count: touch.bars.length,
            bars: touch.bars.map((bar) => bar + 1).join(', '),
          })}
        </p>
      )}
    </section>
  );
}
