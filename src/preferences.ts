/** User preference changes that touch more than the stored settings. */
import { changeLanguage } from './i18n';
import { detectLanguage } from './i18n/languages';
import { setDevInputEnabled } from './input/dev/devInput';
import { setMicDelay, setMicGate, startMic, stopMic } from './input/mic/micInput';
import type { InputMode } from './input/routing';
import { updateSettings, useSettings } from './storage/settings';

/** `null` follows the browser's language. */
export function setLanguagePreference(language: string | null): void {
  updateSettings({ language });
  void changeLanguage(language ?? detectLanguage(navigator.languages));
}

export function setDevKeyboardPreference(enabled: boolean): void {
  updateSettings({ devKeyboard: enabled });
  setDevInputEnabled(enabled);
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
