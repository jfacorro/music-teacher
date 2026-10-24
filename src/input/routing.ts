/**
 * Decides which instrument the app listens to (PLAN.md §5): MIDI, the microphone, or
 * automatically MIDI when a keyboard is connected and the microphone otherwise. Only one is
 * active at a time, so the same key isn't counted twice when both are on. The computer
 * keyboard and the on-screen keyboard are always active. The voice course listens to the
 * microphone, whatever the setting says for the piano.
 */
import { create } from 'zustand';
import { Course } from '../content/courses';
import { useSettings } from '../storage/settings';
import { setActiveSources } from './bus';
import { pruneHeld } from './liveStore';
import { useMic, MicStatus } from './mic/micInput';
import { useMidi, MidiConnection } from './midi/midiInput';
import { InputMode, InputSource, Instrument } from './types';

// Defined with the input types (no dependencies), so the settings can use them too.
export { InputMode, Instrument };

export const INPUT_MODES: readonly InputMode[] = [InputMode.Auto, InputMode.Midi, InputMode.Mic];

export function activeInstrument(
  mode: InputMode,
  midiConnected: boolean,
  micOn: boolean,
): Instrument | null {
  if (mode !== InputMode.Auto) return mode;
  if (midiConnected) return Instrument.Midi;
  return micOn ? Instrument.Mic : null;
}

export const useInstrument = create<{ instrument: Instrument | null }>(() => ({
  instrument: null,
}));

export function startRouting(): () => void {
  let initialized = false;
  const update = () => {
    const { course, inputMode } = useSettings.getState();
    const instrument = activeInstrument(
      course === Course.Voice ? InputMode.Mic : inputMode,
      useMidi.getState().connection === MidiConnection.Connected,
      useMic.getState().status === MicStatus.On,
    );
    if (initialized && instrument === useInstrument.getState().instrument) return;
    initialized = true;
    const isActive = (source: InputSource) =>
      source === InputSource.Dev || source === InputSource.Screen || source === instrument;
    setActiveSources(isActive);
    pruneHeld(isActive);
    useInstrument.setState({ instrument });
  };
  update();
  const unsubscribers = [
    useSettings.subscribe(update),
    useMidi.subscribe(update),
    useMic.subscribe(update),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
