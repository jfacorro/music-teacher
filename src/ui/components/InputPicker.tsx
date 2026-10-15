import { useTranslation } from 'react-i18next';
import { useMic, MicStatus } from '../../input/mic/micInput';
import { enableMidi, useMidi, MidiAccessState, MidiConnection } from '../../input/midi/midiInput';
import { INPUT_MODES, useInstrument, InputMode, Instrument } from '../../input/routing';
import { enableMic, setInputMode } from '../../preferences';
import { useSettings } from '../../storage/settings';

const DotState = {
  Ok: 'ok',
  Pending: 'pending',
  Problem: 'problem',
  Off: 'off',
} as const;
type DotState = (typeof DotState)[keyof typeof DotState];

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
    access === MidiAccessState.Unsupported
      ? { text: t('midiBadge.unsupported'), state: DotState.Off }
      : access === MidiAccessState.Denied
        ? { text: t('midiBadge.denied'), state: DotState.Problem }
        : access === MidiAccessState.Requesting
          ? { text: t('midiBadge.connecting'), state: DotState.Pending }
          : access !== MidiAccessState.Granted
            ? { text: t('midiBadge.off'), state: DotState.Off }
            : connection === MidiConnection.Connected
              ? { text: deviceName ?? t('inputPicker.midi'), state: DotState.Ok }
              : connection === MidiConnection.Connecting
                ? { text: t('midiBadge.connecting'), state: DotState.Pending }
                : connection === MidiConnection.Busy
                  ? { text: t('midiBadge.busy'), state: DotState.Problem }
                  : connection === MidiConnection.Disconnected
                    ? { text: t('midiBadge.disconnected'), state: DotState.Problem }
                    : { text: t('midiBadge.none'), state: DotState.Off };
  const mic: { text: string; state: DotState } =
    micStatus === MicStatus.On
      ? { text: t('micBadge.on'), state: DotState.Ok }
      : micStatus === MicStatus.Starting
        ? { text: t('micBadge.starting'), state: DotState.Pending }
        : micStatus === MicStatus.Denied
          ? { text: t('micBadge.denied'), state: DotState.Problem }
          : micStatus === MicStatus.Error
            ? { text: t('micBadge.error'), state: DotState.Problem }
            : micStatus === MicStatus.Unsupported
              ? { text: t('micBadge.unsupported'), state: DotState.Off }
              : { text: t('micBadge.off'), state: DotState.Off };

  // Automatic mode shows what it's listening to right now.
  const active = instrument === Instrument.Midi ? midi : instrument === Instrument.Mic ? mic : null;
  const labels: Record<InputMode, string> = {
    auto: t('inputPicker.auto', { status: active?.text ?? t('inputPicker.nothing') }),
    midi: midi.text,
    mic: mic.text,
  };
  const state =
    mode === InputMode.Midi
      ? midi.state
      : mode === InputMode.Mic
        ? mic.state
        : (active?.state ?? DotState.Off);

  const choose = (next: InputMode) => {
    setInputMode(next);
    if (
      next === InputMode.Midi &&
      (access === MidiAccessState.Idle || access === MidiAccessState.Denied)
    )
      void enableMidi();
    if (next === InputMode.Mic && micStatus !== MicStatus.On && micStatus !== MicStatus.Starting)
      void enableMic();
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
