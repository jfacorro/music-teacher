import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMic } from '../../input/mic/micInput';
import { useMidi } from '../../input/midi/midiInput';
import { useSettings } from '../../storage/settings';

type BadgeState = 'ok' | 'pending' | 'problem' | 'off';

/** Compact status of the instrument being listened to; links to the settings. */
export function MidiStatusBadge() {
  const { t } = useTranslation();
  const mode = useSettings((s) => s.inputMode);
  const access = useMidi((s) => s.access);
  const connection = useMidi((s) => s.connection);
  const deviceName = useMidi((s) => s.selectedName);
  const micStatus = useMic((s) => s.status);

  // The microphone is shown when chosen, or in automatic mode without a MIDI keyboard.
  const showMic =
    mode === 'mic' || (mode === 'auto' && connection !== 'connected' && micStatus === 'on');

  let label: string;
  let state: BadgeState;
  if (showMic) {
    label = micStatus === 'on' ? t('micBadge.on') : t('micBadge.off');
    state = micStatus === 'on' ? 'ok' : micStatus === 'starting' ? 'pending' : 'off';
  } else if (access === 'unsupported') {
    label = t('midiBadge.unsupported');
    state = 'off';
  } else if (access !== 'granted') {
    label = t('midiBadge.off');
    state = 'off';
  } else {
    switch (connection) {
      case 'connected':
        label = deviceName ?? '';
        state = 'ok';
        break;
      case 'connecting':
        label = t('midiBadge.connecting');
        state = 'pending';
        break;
      case 'busy':
        label = t('midiBadge.busy');
        state = 'problem';
        break;
      case 'disconnected':
        label = t('midiBadge.disconnected');
        state = 'problem';
        break;
      case 'none':
        label = t('midiBadge.none');
        state = 'off';
        break;
    }
  }

  return (
    <Link
      to="/settings"
      className={`midi-badge midi-badge--${state}`}
      aria-label={t(showMic ? 'micBadge.label' : 'midiBadge.label', { status: label })}
    >
      <span className="midi-badge__dot" aria-hidden="true" />
      {label}
    </Link>
  );
}
