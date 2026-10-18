import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { isUnmeasuredOutput, useSoundOutput } from '../../audio/output';
import { useSettings } from '../../storage/settings';

/** Where Settings measures the click timing. */
export const MEASURE_TIMING_PATH = '/settings#sound';

/**
 * Sound goes to an output whose click timing hasn't been measured (another's has): with
 * Bluetooth headphones, the clicks would come late, and notes played with them look late.
 */
export function SoundOutputNotice() {
  const { t } = useTranslation('screens');
  const output = useSoundOutput((s) => s.name);
  const timings = useSettings((s) => s.soundTimings);
  if (!isUnmeasuredOutput(timings, output)) return null;
  return (
    <p className="notice practice__notice">
      {t('practice.unmeasuredOutput', { output })}{' '}
      <Link to={MEASURE_TIMING_PATH}>{t('practice.measureTiming')}</Link>
    </p>
  );
}
