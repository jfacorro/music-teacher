/**
 * Decides which instrument the app listens to (PLAN.md §5): MIDI, the microphone, or
 * automatically MIDI when a keyboard is connected and the microphone otherwise. Only one is
 * active at a time, so the same key isn't counted twice when both are on. The computer
 * keyboard and the on-screen keyboard are always active.
 */
import { create } from 'zustand';
import { useSettings } from '../storage/settings';
import { setActiveSources } from './bus';
import { pruneHeld } from './liveStore';
import { useMic } from './mic/micInput';
import { useMidi } from './midi/midiInput';
import type { InputSourceKind } from './types';

export type InputMode = 'auto' | 'midi' | 'mic';
export type Instrument = 'midi' | 'mic' | null;

export const INPUT_MODES: readonly InputMode[] = ['auto', 'midi', 'mic'];

export function activeInstrument(
  mode: InputMode,
  midiConnected: boolean,
  micOn: boolean,
): Instrument {
  if (mode !== 'auto') return mode;
  if (midiConnected) return 'midi';
  return micOn ? 'mic' : null;
}

export const useInstrument = create<{ instrument: Instrument }>(() => ({ instrument: null }));

export function startRouting(): () => void {
  let initialized = false;
  const update = () => {
    const instrument = activeInstrument(
      useSettings.getState().inputMode,
      useMidi.getState().connection === 'connected',
      useMic.getState().status === 'on',
    );
    if (initialized && instrument === useInstrument.getState().instrument) return;
    initialized = true;
    const isActive = (source: InputSourceKind) =>
      source === 'dev' || source === 'screen' || source === instrument;
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
