import { create } from 'zustand';
import { Course } from '../content/courses';
import { SheetNotation } from '../content/lessons';
import type { NamingSystem } from '../i18n/naming';
import { DEFAULT_VOLUMES } from '../audio/volume';
import { InputMode } from '../input/types';
import type { VocalRange } from '../engine/vocalRange';
import { KeyHeight, KeysShown, Theme } from '../ui/appearance';
import { MetronomeChoice } from '../ui/metronomeChoice';
import { db } from './db';

export interface Settings {
  /** The first-launch setup was finished or skipped. */
  firstLaunchDone: boolean;
  /** What's being practiced, the piano or the voice: the app's sections follow it. */
  course: Course;
  /** null = follow the browser's language. */
  language: string | null;
  /** null = the default for the current language. */
  namingSystem: NamingSystem | null;
  showOctave: boolean;
  /** Sheet music level to start with when a lesson doesn't set one. */
  sheetNotation: SheetNotation;
  devKeyboard: boolean;
  /** Piano sound for the computer and on-screen keyboards. */
  keySound: boolean;
  /** Clicks are played this much earlier to make up for output delay the browser misses, ms. */
  soundTimingMs: number;
  /** The timing measured for each sound output, by its name; followed as outputs change. */
  soundTimings: Record<string, number>;
  /** Metronome clicks, 0–100 %. */
  metronomeVolume: number;
  /** Whether exercises start with the metronome on: as each one usually does, always or never. */
  exerciseMetronome: MetronomeChoice;
  /** The app's piano (autoplay, the other hand, computer and on-screen keys), 0–100 %. */
  pianoVolume: number;
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
  /**
   * The browser takes the app's own sound out of the microphone (echo cancellation), to try
   * singing along through speakers; it may bend musical tones, so it's off unless chosen.
   */
  micEchoCancellation: boolean;
  /** Light, dark, or the computer's setting. */
  theme: Theme;
  /** How tall the on-screen keyboard's keys are. */
  keyHeight: KeyHeight;
  /** How many keys the on-screen keyboard shows around the music. */
  keysShown: KeysShown;
  /** The latest vocal range test (Settings → Voice); null until one is done. */
  vocalRange: VocalRange | null;
  /** The sidebar shows only its icons (on a wide window; a narrow one hides it anyway). */
  sidebarCollapsed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  firstLaunchDone: false,
  course: Course.Piano,
  language: null,
  namingSystem: null,
  showOctave: false,
  sheetNotation: SheetNotation.Names,
  devKeyboard: true,
  keySound: true,
  soundTimingMs: 0,
  soundTimings: {},
  metronomeVolume: DEFAULT_VOLUMES.metronome,
  exerciseMetronome: MetronomeChoice.Auto,
  pianoVolume: DEFAULT_VOLUMES.piano,
  midiInputId: null,
  midiInputName: null,
  inputMode: InputMode.Auto,
  micEnabled: false,
  micDeviceId: null,
  micNoiseFloorDb: -65,
  micSensitivityDb: 12,
  micLatencyMs: 0,
  micEchoCancellation: false,
  theme: Theme.System,
  keyHeight: KeyHeight.Normal,
  keysShown: KeysShown.Fit,
  vocalRange: null,
  sidebarCollapsed: false,
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
