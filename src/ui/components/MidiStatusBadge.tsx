import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMidi } from '../../input/midi/midiInput';

type BadgeState = 'ok' | 'pending' | 'problem' | 'off';

/** Compact MIDI status in the header; links to the MIDI settings. */
export function MidiStatusBadge() {
  const { t } = useTranslation();
  const access = useMidi((s) => s.access);
  const connection = useMidi((s) => s.connection);
  const deviceName = useMidi((s) => s.selectedName);

  let label: string;
  let state: BadgeState;
  if (access === 'unsupported') {
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
      aria-label={t('midiBadge.label', { status: label })}
    >
      <span className="midi-badge__dot" aria-hidden="true" />
      {label}
    </Link>
  );
}
