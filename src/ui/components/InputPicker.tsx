import { IconChevronDown } from '@tabler/icons-react';
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

interface Badge {
  text: string;
  state: DotState;
}

/** Until the browser grants MIDI access, the badge shows the access state. */
const MIDI_ACCESS_BADGES = {
  [MidiAccessState.Unsupported]: { key: 'midiBadge.unsupported', state: DotState.Off },
  [MidiAccessState.Idle]: { key: 'midiBadge.off', state: DotState.Off },
  [MidiAccessState.Requesting]: { key: 'midiBadge.connecting', state: DotState.Pending },
  [MidiAccessState.Denied]: { key: 'midiBadge.denied', state: DotState.Problem },
} as const satisfies Record<
  Exclude<MidiAccessState, typeof MidiAccessState.Granted>,
  { key: string; state: DotState }
>;

/** Once it's granted, the badge shows the keyboard's connection. */
const MIDI_CONNECTION_DOTS: Record<MidiConnection, DotState> = {
  [MidiConnection.None]: DotState.Off,
  [MidiConnection.Connecting]: DotState.Pending,
  [MidiConnection.Connected]: DotState.Ok,
  [MidiConnection.Busy]: DotState.Problem,
  [MidiConnection.Disconnected]: DotState.Problem,
};

const MIC_DOTS: Record<MicStatus, DotState> = {
  [MicStatus.On]: DotState.Ok,
  [MicStatus.Starting]: DotState.Pending,
  [MicStatus.Denied]: DotState.Problem,
  [MicStatus.Error]: DotState.Problem,
  [MicStatus.Unsupported]: DotState.Off,
  [MicStatus.Off]: DotState.Off,
};

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

  const midi: Badge =
    access !== MidiAccessState.Granted
      ? { text: t(MIDI_ACCESS_BADGES[access].key), state: MIDI_ACCESS_BADGES[access].state }
      : {
          text:
            connection === MidiConnection.Connected
              ? (deviceName ?? t('inputPicker.midi'))
              : t(`midiBadge.${connection}`),
          state: MIDI_CONNECTION_DOTS[connection],
        };
  const mic: Badge = { text: t(`micBadge.${micStatus}`), state: MIC_DOTS[micStatus] };

  // Automatic mode shows what it's listening to right now.
  const active = instrument === Instrument.Midi ? midi : instrument === Instrument.Mic ? mic : null;
  const labels: Record<InputMode, string> = {
    [InputMode.Auto]: t('inputPicker.auto', { status: active?.text ?? t('inputPicker.nothing') }),
    [InputMode.Midi]: midi.text,
    [InputMode.Mic]: mic.text,
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
      {/* Shown instead of the select's own arrow when only the dot shows (a narrow window). */}
      <IconChevronDown className="input-picker__chevron" size={14} aria-hidden="true" />
    </label>
  );
}
