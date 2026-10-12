import { preloadAudio } from './audio/audio';
import { startKeySound } from './audio/keySound';
import { initI18n } from './i18n';
import { detectLanguage } from './i18n/languages';
import { setDevInputEnabled } from './input/dev/devInput';
import { startLiveTracking } from './input/liveStore';
import { micPermission, setMicDelay, setMicGate, startMic } from './input/mic/micInput';
import { configureMidi, enableMidi, midiPermission } from './input/midi/midiInput';
import { startRouting } from './input/routing';
import { loadSettings, updateSettings } from './storage/settings';

/** Everything that must be ready before the first render. */
export async function bootstrap(): Promise<void> {
  const settings = await loadSettings();
  await initI18n(settings.language ?? detectLanguage(navigator.languages));

  startLiveTracking();
  startRouting();
  setDevInputEnabled(settings.devKeyboard);
  startKeySound();
  preloadAudio(); // so the first key press isn't delayed by loading the audio library

  configureMidi({
    preferredId: settings.midiInputId,
    preferredName: settings.midiInputName,
    onDeviceSelected: ({ id, name }) => updateSettings({ midiInputId: id, midiInputName: name }),
  });
  setMicGate(settings.micNoiseFloorDb + settings.micSensitivityDb);
  setMicDelay(settings.micLatencyMs);

  // Reconnect devices right away only if they were allowed before; otherwise wait for the
  // user to ask, so permission prompts don't appear out of context.
  if ((await midiPermission()) === 'granted') void enableMidi();
  if (settings.micEnabled && (await micPermission()) === 'granted') {
    void startMic(settings.micDeviceId);
  }
}
