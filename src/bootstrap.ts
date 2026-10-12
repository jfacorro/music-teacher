import { initI18n } from './i18n';
import { detectLanguage } from './i18n/languages';
import { setDevInputEnabled } from './input/dev/devInput';
import { startLiveTracking } from './input/liveStore';
import { configureMidi, enableMidi, midiPermission } from './input/midi/midiInput';
import { loadSettings, updateSettings } from './storage/settings';

/** Everything that must be ready before the first render. */
export async function bootstrap(): Promise<void> {
  const settings = await loadSettings();
  await initI18n(settings.language ?? detectLanguage(navigator.languages));

  startLiveTracking();
  setDevInputEnabled(settings.devKeyboard);

  configureMidi({
    preferredId: settings.midiInputId,
    preferredName: settings.midiInputName,
    onDeviceSelected: ({ id, name }) => updateSettings({ midiInputId: id, midiInputName: name }),
  });
  // Connect right away only if MIDI was allowed before; otherwise wait for the user to ask,
  // so the browser's permission prompt doesn't appear out of context.
  if ((await midiPermission()) === 'granted') void enableMidi();
}
