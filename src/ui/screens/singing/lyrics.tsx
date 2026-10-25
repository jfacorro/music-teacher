/**
 * A song's words (PLAN.md milestone 6.6): the language they're sung in, chosen once for every
 * song (the app's language to start with), and the words as text, to read before singing.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { lyricLanguages } from '../../../engine/lyrics';
import type { Score } from '../../../engine/score';
import { languageDisplayName } from '../../../i18n/languages';
import { updateSettings } from '../../../storage/settings';
import { useLyricsLanguage } from './useLyricsLanguage';

/** Which language to sing the words in, for a song that has them in more than one. */
export function LyricsSelect({ score }: { score: Score }) {
  const { t } = useTranslation('screens');
  const id = useId();
  const language = useLyricsLanguage(score);
  const languages = lyricLanguages(score);
  if (!language || languages.length < 2) return null;
  return (
    <label className="inline-field" htmlFor={id} title={t('sing.lyricsTip')}>
      {t('sing.lyrics')}
      <select
        id={id}
        value={language}
        onChange={(e) => updateSettings({ lyricsLanguage: e.target.value })}
      >
        {languages.map((option) => (
          <option key={option} value={option} lang={option}>
            {languageDisplayName(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The words as they're read, a line at a time. */
export function SongWords({ score }: { score: Score }) {
  const { t } = useTranslation('screens');
  const language = useLyricsLanguage(score);
  const lines = language ? score.lyrics?.lines[language] : undefined;
  if (!language || !lines) return null;
  return (
    <section className="card song-words" aria-labelledby="song-words">
      <h2 id="song-words">{t('sing.words')}</h2>
      <p lang={language}>
        {lines.map((line, i) => (
          <span key={i} className="song-words__line">
            {line}
          </span>
        ))}
      </p>
    </section>
  );
}
