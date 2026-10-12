import { useTranslation } from 'react-i18next';
import { useMic } from '../../../input/mic/micInput';
import { useMidi } from '../../../input/midi/midiInput';
import { INPUT_MODES, useInstrument } from '../../../input/routing';
import { setInputMode } from '../../../preferences';
import { useSettings } from '../../../storage/settings';

/** Which instrument the app listens to: MIDI, the microphone, or automatic. */
export function InputSettings() {
  const { t } = useTranslation('screens');
  const mode = useSettings((s) => s.inputMode);
  const instrument = useInstrument((s) => s.instrument);
  const midiName = useMidi((s) => s.selectedName);
  const midiConnected = useMidi((s) => s.connection === 'connected');
  const micOn = useMic((s) => s.status === 'on');

  const listening =
    instrument === 'midi'
      ? midiConnected
        ? { ok: true, text: t('settings.input.listening.midi', { device: midiName ?? '' }) }
        : { ok: false, text: t('settings.input.listening.midiOff') }
      : instrument === 'mic'
        ? micOn
          ? { ok: true, text: t('settings.input.listening.mic') }
          : { ok: false, text: t('settings.input.listening.micOff') }
        : { ok: false, text: t('settings.input.listening.none') };

  return (
    <section className="card">
      <h2>{t('settings.input.heading')}</h2>
      <div className="segmented" role="radiogroup" aria-label={t('settings.input.heading')}>
        {INPUT_MODES.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            className={mode === value ? 'segmented__option is-selected' : 'segmented__option'}
            onClick={() => setInputMode(value)}
          >
            {t(`settings.input.modes.${value}`)}
          </button>
        ))}
      </div>
      <p className="muted">{t(`settings.input.hints.${mode}`)}</p>
      <p className={listening.ok ? 'notice notice--ok' : 'notice'} role="status">
        {listening.text}
      </p>
    </section>
  );
}
