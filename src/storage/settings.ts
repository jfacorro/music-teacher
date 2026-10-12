import { create } from 'zustand';
import type { NamingSystem } from '../i18n/naming';
import { db } from './db';

export interface Settings {
  /** null = follow the browser's language. */
  language: string | null;
  /** null = the default for the current language. */
  namingSystem: NamingSystem | null;
  showOctave: boolean;
  devKeyboard: boolean;
  midiInputId: string | null;
  midiInputName: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  language: null,
  namingSystem: null,
  showOctave: false,
  devKeyboard: true,
  midiInputId: null,
  midiInputName: null,
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
