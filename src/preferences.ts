/** User preference changes that touch more than the stored settings. */
import { setSoundTimingCorrection, setVolumes } from './audio/audio';
import { timingForOutput, useSoundOutput } from './audio/output';
import { changeLanguage } from './i18n';
import { detectLanguage } from './i18n/languages';
import { setDevInputEnabled } from './input/dev/devInput';
import { setMicDelay, setMicGate, startMic, stopMic } from './input/mic/micInput';
import type { InputMode } from './input/routing';
import { type Settings, updateSettings, useSettings } from './storage/settings';
import { applyTheme, type Theme } from './ui/appearance';

/** `null` follows the browser's language. */
export function setLanguagePreference(language: string | null): void {
  updateSettings({ language });
  void changeLanguage(language ?? detectLanguage(navigator.languages));
}

export function setThemePreference(theme: Theme): void {
  updateSettings({ theme });
  applyTheme(theme);
}

export function setDevKeyboardPreference(enabled: boolean): void {
  updateSettings({ devKeyboard: enabled });
  setDevInputEnabled(enabled);
}

/** The click timing, measured (or reset) for the output sound goes to now. */
export function setSoundTiming(ms: number): void {
  const soundTimingMs = Math.round(ms);
  const output = useSoundOutput.getState().name;
  updateSettings({
    soundTimingMs,
    ...(output !== null && {
      soundTimings: { ...useSettings.getState().soundTimings, [output]: soundTimingMs },
    }),
  });
  setSoundTimingCorrection(soundTimingMs);
}

/** Sound moved to another output: use the timing measured for it (none if it never was). */
export function followSoundOutput(output: string | null): void {
  const soundTimingMs = timingForOutput(useSettings.getState().soundTimings, output);
  if (soundTimingMs === null || soundTimingMs === useSettings.getState().soundTimingMs) return;
  updateSettings({ soundTimingMs });
  setSoundTimingCorrection(soundTimingMs);
}

/** Metronome and/or piano volume, 0–100 %: saved, and heard right away. */
export function setVolume(patch: Partial<Pick<Settings, 'metronomeVolume' | 'pianoVolume'>>): void {
  updateSettings(patch);
  const { metronomeVolume, pianoVolume } = useSettings.getState();
  setVolumes({ metronome: metronomeVolume, piano: pianoVolume });
}

export function setInputMode(inputMode: InputMode): void {
  updateSettings({ inputMode });
}

export async function enableMic(deviceId: string | null = useSettings.getState().micDeviceId) {
  updateSettings({ micEnabled: true, micDeviceId: deviceId });
  await startMic(deviceId);
}

export function disableMic(): void {
  updateSettings({ micEnabled: false });
  stopMic();
}

export function setMicCalibration(
  patch: Partial<{ noiseFloorDb: number; sensitivityDb: number; latencyMs: number }>,
): void {
  const current = useSettings.getState();
  const noiseFloorDb = patch.noiseFloorDb ?? current.micNoiseFloorDb;
  const sensitivityDb = patch.sensitivityDb ?? current.micSensitivityDb;
  const latencyMs = Math.round(patch.latencyMs ?? current.micLatencyMs);
  updateSettings({
    micNoiseFloorDb: noiseFloorDb,
    micSensitivityDb: sensitivityDb,
    micLatencyMs: latencyMs,
  });
  setMicGate(noiseFloorDb + sensitivityDb);
  setMicDelay(latencyMs);
}
