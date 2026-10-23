import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DrillLevel } from '../../../content/sightReading';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { type NoteString, pitchOf } from '../../../theory/pitch';

/** A sight-reading level's name, with note names in the learner's naming system. */
export function useDrillLevelName(): (level: DrillLevel) => string {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  return useCallback(
    (level: DrillLevel) => {
      const name = (note: NoteString) => names.name(pitchOf(note), { octave: false });
      return t(`sightReading.levels.${level}`, {
        g: name('G4'),
        f: name('F4'),
        d: name('D4'),
        bFlat: name('Bb4'),
        a: name('A4'),
        e: name('E4'),
      });
    },
    [t, names],
  );
}
