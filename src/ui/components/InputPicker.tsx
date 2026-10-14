import { useTranslation } from 'react-i18next';
import { useMic } from '../../input/mic/micInput';
import { enableMidi, useMidi } from '../../input/midi/midiInput';
import { INPUT_MODES, useInstrument, type InputMode } from '../../input/routing';
import { enableMic, setInputMode } from '../../preferences';
import { useSettings } from '../../storage/settings';

type DotState = 'ok' | 'pending' | 'problem' | 'off';

/**
 * Always in the header: which instrument the app listens to, with its status, and a menu to
 * switch between MIDI, the microphone and automatic. Choosing one turns it on if needed.
 */
export function InputPicker() {
  const { t } = useTranslation();
  const mode = useSettings((s) => s.inputMode);
  const instrument = useInstrument((s) => s.instrument);
  const access = useMidi((s) => s.access);
  const connection = useMidi((s) => s.connection);
  const deviceName = useMidi((s) => s.selectedName);
  const micStatus = useMic((s) => s.status);

  const midi: { text: string; state: DotState } =
    access === 'unsupported'
      ? { text: t('midiBadge.unsupported'), state: 'off' }
      : access === 'denied'
        ? { text: t('midiBadge.denied'), state: 'problem' }
        : access === 'requesting'
          ? { text: t('midiBadge.connecting'), state: 'pending' }
          : access !== 'granted'
            ? { text: t('midiBadge.off'), state: 'off' }
            : connection === 'connected'
              ? { text: deviceName ?? t('inputPicker.midi'), state: 'ok' }
              : connection === 'connecting'
                ? { text: t('midiBadge.connecting'), state: 'pending' }
                : connection === 'busy'
                  ? { text: t('midiBadge.busy'), state: 'problem' }
                  : connection === 'disconnected'
                    ? { text: t('midiBadge.disconnected'), state: 'problem' }
                    : { text: t('midiBadge.none'), state: 'off' };
  const mic: { text: string; state: DotState } =
    micStatus === 'on'
      ? { text: t('micBadge.on'), state: 'ok' }
      : micStatus === 'starting'
        ? { text: t('micBadge.starting'), state: 'pending' }
        : micStatus === 'denied'
          ? { text: t('micBadge.denied'), state: 'problem' }
          : micStatus === 'error'
            ? { text: t('micBadge.error'), state: 'problem' }
            : micStatus === 'unsupported'
              ? { text: t('micBadge.unsupported'), state: 'off' }
              : { text: t('micBadge.off'), state: 'off' };

  // Automatic mode shows what it's listening to right now.
  const active = instrument === 'midi' ? midi : instrument === 'mic' ? mic : null;
  const labels: Record<InputMode, string> = {
    auto: t('inputPicker.auto', { status: active?.text ?? t('inputPicker.nothing') }),
    midi: midi.text,
    mic: mic.text,
  };
  const state =
    mode === 'midi' ? midi.state : mode === 'mic' ? mic.state : (active?.state ?? 'off');

  const choose = (next: InputMode) => {
    setInputMode(next);
    if (next === 'midi' && (access === 'idle' || access === 'denied')) void enableMidi();
    if (next === 'mic' && micStatus !== 'on' && micStatus !== 'starting') void enableMic();
  };

  return (
    <label className={`input-picker input-picker--${state}`}>
      <span className="input-picker__dot" aria-hidden="true" />
      <select
        aria-label={t('inputPicker.label')}
        value={mode}
        onChange={(e) => choose(e.target.value as InputMode)}
      >
        {INPUT_MODES.map((value) => (
          <option key={value} value={value}>
            {labels[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
