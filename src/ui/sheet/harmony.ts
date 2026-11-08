/** A song's harmony in words, to show over its sheet music (PLAN.md milestone 7.4). */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { chordIn } from '../../engine/harmony';
import type { Score } from '../../engine/score';
import { useNoteNames } from '../../i18n/useNoteNames';

export interface SheetHarmony {
  /** Each chord where it starts: its numeral, and its name in the music's key. */
  chords: { beat: number; numeral: string; name: string }[];
  cadences: { measure: number; label: string }[];
  sections: { measure: number; name: string }[];
}

/** The harmony of `score` in its key (moved, if it was), or null when it isn't shown or written. */
export function useSheetHarmony(score: Score, shown: boolean): SheetHarmony | null {
  const { t } = useTranslation('screens');
  const { t: tt } = useTranslation('theory');
  const names = useNoteNames();
  return useMemo(() => {
    const { analysis } = score;
    if (!shown || !analysis) return null;
    const keyFifths = score.keyFifths ?? 0;
    return {
      chords: analysis.chords.map(({ start, numeral }) => {
        const { notes, quality } = chordIn(keyFifths, numeral);
        return {
          beat: start,
          numeral: tt(`answers.${numeral}`),
          name: tt(`symbols.${quality}`, { root: names.name(notes[0]!, { octave: false }) }),
        };
      }),
      cadences: analysis.cadences.map(({ measure, kind }) => ({
        measure,
        label: t(`practice.cadences.${kind}`),
      })),
      sections: analysis.sections,
    };
  }, [score, shown, t, tt, names]);
}
