import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { DrillLevel } from '../../../content/sightReading';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { pitchOf } from '../../../theory/pitch';

/** A sight-reading level's name, with note names in the learner's naming system. */
export function useDrillLevelName(): (level: DrillLevel) => string {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  return useCallback(
    (level: DrillLevel) =>
      t(`sightReading.levels.${level}`, {
        g: names.name(pitchOf('G4'), { octave: false }),
        f: names.name(pitchOf('F4'), { octave: false }),
      }),
    [t, names],
  );
}
