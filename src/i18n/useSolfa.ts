import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Pitch } from '../theory/pitch';
import { solfaOf } from '../theory/solfa';
import { ACCIDENTAL_SYMBOLS } from './naming';

/**
 * A note's syllable in movable do (do = the key note of `keyFifths`), in the UI language: ti in
 * English, si in Spanish. A note outside the key gets its sharp or flat (fa♯).
 */
export function useSolfa(): (pitch: Pick<Pitch, 'step' | 'alter'>, keyFifths?: number) => string {
  const { t } = useTranslation('screens');
  return useCallback(
    (pitch, keyFifths = 0) => {
      const { degree, alter } = solfaOf(pitch, keyFifths);
      return t(`solfa.${degree}`) + ACCIDENTAL_SYMBOLS[alter];
    },
    [t],
  );
}
