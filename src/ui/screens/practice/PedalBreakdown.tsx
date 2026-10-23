import { useTranslation } from 'react-i18next';
import { PEDAL_PASS_SHARE, type PedalSummary } from '../../../engine/pedal';

const CHECK = '✓';
const CROSS = '✗';

/** Results: how the pedal went (pressed and lifted in time, up where it isn't marked), and where. */
export function PedalBreakdown({ pedal }: { pedal: PedalSummary }) {
  const { t } = useTranslation('screens');
  return (
    <section className="touch-results">
      <h3>{t('practice.pedal.heading')}</h3>
      {pedal.silent && <p className="notice">{t('practice.pedal.silent')}</p>}
      <ul className="touch-results__list">
        {pedal.kinds.map(({ kind, right, total }) => {
          const ok = right / total >= PEDAL_PASS_SHARE - 1e-9;
          return (
            <li key={kind} className="touch-results__item">
              <span className="touch-results__kind">{t(`practice.pedal.kinds.${kind}`)}</span>
              <span>{t(`practice.pedal.counts.${kind}`, { right, total })}</span>
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
      {pedal.bars.length > 0 && (
        <p className="muted">
          {t('practice.touch.bars', {
            count: pedal.bars.length,
            bars: pedal.bars.map((bar) => bar + 1).join(', '),
          })}
        </p>
      )}
    </section>
  );
}
