/**
 * Plays the notes from the computer keyboard and the on-screen keyboard, which have no sound
 * of their own. MIDI notes stay silent (the piano has its own speakers), and nothing plays
 * while listening through the microphone, so it doesn't hear the app.
 */
import { subscribeNotes } from '../input/bus';
import { useInstrument, Instrument } from '../input/routing';
import { useSettings } from '../storage/settings';
import { startAudio } from './audio';
import { InputSource, NoteEventType } from '../input/types';

export function startKeySound(): () => void {
  const sounding = new Set<number>();
  return subscribeNotes((event) => {
    if (event.source !== InputSource.Dev && event.source !== InputSource.Screen) return;
    if (event.type === NoteEventType.On) {
      if (!useSettings.getState().keySound) return;
      if (useInstrument.getState().instrument === Instrument.Mic) return;
      sounding.add(event.pitch);
      // The first key press also starts audio (key and pointer presses allow it).
      void startAudio().then((audio) => audio.noteOn(event.pitch, event.velocity));
    } else if (sounding.delete(event.pitch)) {
      void startAudio().then((audio) => audio.noteOff(event.pitch));
    }
  });
}
