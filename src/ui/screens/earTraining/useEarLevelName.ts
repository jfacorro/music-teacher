import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { EarLevel } from '../../../content/earTraining';

/** An ear-training level's name. */
export function useEarLevelName(): (level: EarLevel) => string {
  const { t } = useTranslation('screens');
  return useCallback((level: EarLevel) => t(`earTraining.levels.${level}`), [t]);
}
