import { useTranslation } from 'react-i18next';
import type { PitchLean } from '../../engine/tuner';

/**
 * In a singing run's results: which way most notes leaned, flat or sharp, by how much on
 * average, and what usually helps. Nothing when they didn't lean one way.
 */
export function PitchLeanLine({ lean }: { lean: PitchLean | null }) {
  const { t } = useTranslation('screens');
  if (!lean) return null;
  const sharp = lean.cents > 0;
  return (
    <p className="pitch-lean">
      <strong>
        {t(sharp ? 'tuner.lean.sharp' : 'tuner.lean.flat', {
          count: lean.count,
          total: lean.total,
          cents: Math.abs(lean.cents),
        })}
      </strong>{' '}
      <span className="muted">{t(sharp ? 'tuner.lean.sharpTip' : 'tuner.lean.flatTip')}</span>
    </p>
  );
}
