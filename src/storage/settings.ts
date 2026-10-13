import { create } from 'zustand';
import type { NamingSystem } from '../i18n/naming';
import type { InputMode } from '../input/routing';
import { db } from './db';

export interface Settings {
  /** The first-launch setup was finished or skipped. */
  firstLaunchDone: boolean;
  /** null = follow the browser's language. */
  language: string | null;
  /** null = the default for the current language. */
  namingSystem: NamingSystem | null;
  showOctave: boolean;
  devKeyboard: boolean;
  /** Piano sound for the computer and on-screen keyboards. */
  keySound: boolean;
  /** Clicks are played this much earlier to make up for output delay the browser misses, ms. */
  soundTimingMs: number;
  midiInputId: string | null;
  midiInputName: string | null;
  /** Which instrument the app listens to (PLAN.md §8 Settings). */
  inputMode: InputMode;
  micEnabled: boolean;
  micDeviceId: string | null;
  /** Measured background level, dBFS. */
  micNoiseFloorDb: number;
  /** How far above the noise a sound must be to count, dB. */
  micSensitivityDb: number;
  /** Extra delay to subtract from microphone notes, from calibration, ms. */
  micLatencyMs: number;
}

export const DEFAULT_SETTINGS: Settings = {
  firstLaunchDone: false,
  language: null,
  namingSystem: null,
  showOctave: false,
  devKeyboard: true,
  keySound: true,
  soundTimingMs: 0,
  midiInputId: null,
  midiInputName: null,
  inputMode: 'auto',
  micEnabled: false,
  micDeviceId: null,
  micNoiseFloorDb: -65,
  micSensitivityDb: 12,
  micLatencyMs: 0,
};

const SETTINGS_KEY = 'app';

export const useSettings = create<Settings>(() => DEFAULT_SETTINGS);

export async function loadSettings(): Promise<Settings> {
  try {
    const row = await db.settings.get(SETTINGS_KEY);
    const settings = { ...DEFAULT_SETTINGS, ...(row?.value as Partial<Settings> | undefined) };
    useSettings.setState(settings, true);
  } catch (error) {
    console.error('Could not load settings; using defaults', error);
  }
  return useSettings.getState();
}

export function updateSettings(patch: Partial<Settings>): void {
  useSettings.setState(patch);
  db.settings.put({ key: SETTINGS_KEY, value: useSettings.getState() }).catch((error: unknown) => {
    console.error('Could not save settings', error);
  });
}
