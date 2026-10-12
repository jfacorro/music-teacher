import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Pitch } from '../theory/pitch';
import { useNoteNames } from './useNoteNames';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Text from content namespaces (courses, lessons), with note variables filled in using the
 * user's naming system: `text('steps.cde', { c: C4, d: D4 })` → "… Do, Re …".
 * The namespace must already be loaded (see `i18n.loadNamespaces`).
 */
export function useContentText(namespace: string) {
  const { i18n } = useTranslation(); // re-renders when the language changes
  const names = useNoteNames();
  // Content namespaces are loaded at runtime, so they aren't in the typed resources.
  const t = i18n.getFixedT(null, namespace as never) as unknown as Translate;

  return useCallback(
    (key: string, vars: Record<string, Pitch> = {}, extra: Record<string, unknown> = {}) =>
      t(key, {
        ...extra,
        ...Object.fromEntries(
          Object.entries(vars).map(([name, pitch]) => [name, names.name(pitch, { octave: false })]),
        ),
      }),
    [t, names],
  );
}
