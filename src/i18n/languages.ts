export const SOURCE_LANGUAGE = 'en';

/** Accented, ~40% longer copy of English for spotting untranslated text and layout overflow. */
export const PSEUDO_LANGUAGE = 'en-XA';

export const TRANSLATED_LANGUAGES: readonly string[] = ['en', 'es'];

export const LANGUAGES: readonly string[] = import.meta.env.DEV
  ? [...TRANSLATED_LANGUAGES, PSEUDO_LANGUAGE]
  : TRANSLATED_LANGUAGES;

/** Picks the best supported language for the browser's preferred languages. */
export function detectLanguage(
  preferred: readonly string[],
  supported: readonly string[] = LANGUAGES,
): string {
  for (const candidate of preferred) {
    const exact = supported.find((lng) => lng.toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;
    const base = candidate.toLowerCase().split('-')[0];
    const sameBase = supported.find((lng) => lng.toLowerCase() === base);
    if (sameBase) return sameBase;
  }
  return SOURCE_LANGUAGE;
}

/** The language's own name for itself ("English", "Español"). */
export function languageDisplayName(language: string): string {
  try {
    const name = new Intl.DisplayNames([language], { type: 'language' }).of(language) ?? language;
    return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
  } catch {
    return language;
  }
}
