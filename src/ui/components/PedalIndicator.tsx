import { useTranslation } from 'react-i18next';
import { MidiConnection, useMidi } from '../../input/midi/midiInput';

/** Lights up while the keyboard's sustain pedal is down (MIDI keyboards only). */
export function PedalIndicator() {
  const { t } = useTranslation();
  const connected = useMidi((s) => s.connection === MidiConnection.Connected);
  const down = useMidi((s) => s.sustain);
  if (!connected) return null;
  return (
    <span
      className={down ? 'pedal is-down' : 'pedal'}
      role="status"
      aria-label={down ? t('pedal.down') : t('pedal.up')}
      title={down ? t('pedal.down') : t('pedal.up')}
    >
      {t('pedal.label')}
    </span>
  );
}
