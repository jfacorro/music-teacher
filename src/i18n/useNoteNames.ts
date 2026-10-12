import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../storage/settings';
import {
  defaultNamingSystem,
  noteName,
  type NamingSystem,
  type NoteNameOptions,
  type Spelled,
} from './naming';

export interface NoteNames {
  system: NamingSystem;
  name: (pitch: Spelled, options?: NoteNameOptions) => string;
}

/** Note names in the user's naming system (or the language default) and octave preference. */
export function useNoteNames(): NoteNames {
  const { i18n } = useTranslation();
  const preferred = useSettings((s) => s.namingSystem);
  const showOctave = useSettings((s) => s.showOctave);
  const system = preferred ?? defaultNamingSystem(i18n.language);

  return useMemo(
    () => ({
      system,
      name: (pitch, options) => noteName(pitch, system, { octave: showOctave, ...options }),
    }),
    [system, showOctave],
  );
}
