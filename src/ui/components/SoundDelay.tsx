import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioIfReady } from '../../audio/audio';

/** Above this, the gap between pressing a key and hearing it is easy to notice. */
const NOTICEABLE_MS = 100;

/** The browser's reported sound output delay, once audio has started. */
export function SoundDelay() {
  const { t } = useTranslation('screens');
  const [delayMs, setDelayMs] = useState<number | null>(null);

  useEffect(() => {
    // The reported value settles over the first second or two, so keep it fresh.
    const update = () => setDelayMs(audioIfReady()?.outputDelayMs() ?? null);
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  if (delayMs === null) return null;
  return (
    <>
      <p className="muted">{t('settings.devKeyboard.delay', { ms: Math.round(delayMs) })}</p>
      {delayMs > NOTICEABLE_MS && (
        <p className="notice notice--problem">{t('settings.devKeyboard.slowOutput')}</p>
      )}
    </>
  );
}
