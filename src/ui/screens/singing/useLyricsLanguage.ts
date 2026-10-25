import { useTranslation } from 'react-i18next';
import { lyricLanguages } from '../../../engine/lyrics';
import type { Score } from '../../../engine/score';
import { SOURCE_LANGUAGE } from '../../../i18n/languages';
import { useSettings } from '../../../storage/settings';

/** The language a score's words are shown in: the one chosen, else the app's; null without words. */
export function useLyricsLanguage(score: Score): string | null {
  const { i18n } = useTranslation();
  const chosen = useSettings((s) => s.lyricsLanguage);
  const languages = lyricLanguages(score);
  const app = i18n.language.split('-')[0]!;
  return (
    [chosen, app, SOURCE_LANGUAGE].find((language) => language && languages.includes(language)) ??
    languages[0] ??
    null
  );
}
