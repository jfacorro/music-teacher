import { preloadAudio, setSoundTimingCorrection, setVolumes } from './audio/audio';
import { useSoundOutput, watchSoundOutput } from './audio/output';
import { startKeySound } from './audio/keySound';
import { initI18n } from './i18n';
import { detectLanguage } from './i18n/languages';
import { setDevInputEnabled } from './input/dev/devInput';
import { startLiveTracking } from './input/liveStore';
import {
  micPermission,
  setMicDelay,
  setMicEchoCancellation,
  setMicGate,
  startMic,
} from './input/mic/micInput';
import { configureMidi, enableMidi, midiPermission } from './input/midi/midiInput';
import { startRouting } from './input/routing';
import { followSoundOutput } from './preferences';
import { loadMySongs } from './storage/mySongs';
import { loadProgress } from './storage/progress';
import { loadSettings, updateSettings, useSettings } from './storage/settings';
import { loadEarTraining } from './storage/earTraining';
import { loadSightReading } from './storage/sightReading';
import { loadTodayPlan } from './storage/todayPlan';
import { applyTheme } from './ui/appearance';

/** Everything that must be ready before the first render. */
export async function bootstrap(): Promise<void> {
  const [settings] = await Promise.all([
    loadSettings(),
    loadProgress(),
    loadMySongs(),
    loadTodayPlan(),
    loadSightReading(),
    loadEarTraining(),
  ]);
  applyTheme(settings.theme);
  await initI18n(settings.language ?? detectLanguage(navigator.languages));

  startLiveTracking();
  startRouting();
  setDevInputEnabled(settings.devKeyboard);
  startKeySound();
  setSoundTimingCorrection(settings.soundTimingMs);
  // The click timing follows the sound output (Bluetooth headphones need much more).
  useSoundOutput.subscribe(({ name }) => followSoundOutput(name));
  watchSoundOutput();
  setVolumes({ metronome: settings.metronomeVolume, piano: settings.pianoVolume });
  preloadAudio(); // so the first key press isn't delayed by loading the audio library

  configureMidi({
    preferredId: settings.midiInputId,
    preferredName: settings.midiInputName,
    onDeviceSelected: ({ id, name }) => updateSettings({ midiInputId: id, midiInputName: name }),
  });
  setMicGate(settings.micNoiseFloorDb + settings.micSensitivityDb);
  setMicDelay(settings.micLatencyMs);
  setMicEchoCancellation(settings.micEchoCancellation);
  // Chosen in Settings → Voice; the microphone restarts with it.
  useSettings.subscribe((now, before) => {
    if (now.micEchoCancellation !== before.micEchoCancellation) {
      setMicEchoCancellation(now.micEchoCancellation);
    }
  });

  // Reconnect devices right away only if they were allowed before; otherwise wait for the
  // user to ask, so permission prompts don't appear out of context.
  if ((await midiPermission()) === 'granted') void enableMidi();
  if (settings.micEnabled && (await micPermission()) === 'granted') {
    void startMic(settings.micDeviceId);
  }
}
