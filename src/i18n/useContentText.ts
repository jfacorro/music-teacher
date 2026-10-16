import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isChordVar, isScaleVar, type TextVar } from '../content/textVars';
import { useNoteNames } from './useNoteNames';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Text from content namespaces (courses, lessons), with note, chord and scale variables filled
 * in using the user's naming system: `text('steps.cde', { c: C4, d: D4 })` → "… Do, Re …",
 * `{ cMajor: { chord: C4, quality: 'major' } }` → "Do mayor".
 * The namespace must already be loaded (see `i18n.loadNamespaces`).
 */
export function useContentText(namespace: string) {
  const { i18n, t: theory } = useTranslation('theory'); // re-renders when the language changes
  const names = useNoteNames();
  // Content namespaces are loaded at runtime, so they aren't in the typed resources.
  const t = i18n.getFixedT(null, namespace as never) as unknown as Translate;

  return useCallback(
    (key: string, vars: Record<string, TextVar> = {}, extra: Record<string, unknown> = {}) => {
      const text = (value: TextVar) =>
        isChordVar(value)
          ? theory(`chords.${value.quality}`, { root: names.name(value.chord, { octave: false }) })
          : isScaleVar(value)
            ? theory(`scales.${value.quality}`, {
                root: names.name(value.scale, { octave: false }),
              })
            : names.name(value, { octave: false });
      return t(key, {
        ...extra,
        ...Object.fromEntries(Object.entries(vars).map(([name, value]) => [name, text(value)])),
      });
    },
    [t, theory, names],
  );
}
