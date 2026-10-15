/**
 * Chord and scale names (PLAN.md Phase 3): every chord quality and scale reads correctly in
 * every language and with every note-naming system ("C major", "Do mayor", "F♯ minor").
 */
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import { valuesOf } from '../lib/values';
import { ChordQuality } from '../theory/chords';
import { pitchOf } from '../theory/pitch';
import { ScaleQuality } from '../content/textVars';
import { TRANSLATED_LANGUAGES } from './languages';
import { NAMING_SYSTEMS, NamingSystem, noteName } from './naming';

interface Theory {
  chords: Record<string, string>;
  scales: Record<string, string>;
}
const theory = import.meta.glob<Theory>('/locales/*/theory.json', {
  eager: true,
  import: 'default',
});

function name(language: string, group: keyof Theory, quality: string, root: string): string {
  const message = theory[`/locales/${language}/theory.json`]?.[group][quality];
  expect(message, `${language} › ${group}.${quality}`).toBeTruthy();
  return String(new IntlMessageFormat(message!, language).format({ root }));
}

describe.each(TRANSLATED_LANGUAGES)('chord and scale names in %s', (language) => {
  it.each(NAMING_SYSTEMS)('name every chord and scale with %s note names', (system) => {
    const root = noteName(pitchOf('F#4'), system, { octave: false });
    for (const quality of valuesOf(ChordQuality)) {
      expect(name(language, 'chords', quality, root)).toContain(root);
    }
    for (const quality of valuesOf(ScaleQuality)) {
      expect(name(language, 'scales', quality, root)).toContain(root);
    }
  });
});

it('reads as musicians say it', () => {
  const english = noteName(pitchOf('C4'), NamingSystem.English, { octave: false });
  const solfege = noteName(pitchOf('C4'), NamingSystem.Solfege, { octave: false });
  expect(name('en', 'chords', ChordQuality.Major, english)).toBe('C major');
  expect(name('es', 'chords', ChordQuality.Major, solfege)).toBe('Do mayor');
  expect(name('es', 'chords', ChordQuality.Minor, solfege)).toBe('Do menor');
  expect(name('en', 'scales', ScaleQuality.Major, english)).toBe('C major scale');
  expect(name('es', 'scales', ScaleQuality.Major, solfege)).toBe('escala de Do mayor');
});
