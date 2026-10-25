import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { VOICE_SONG_IDS } from '../../../content/songs';
import { LessonStatus } from '../../../content/unlock';
import { resultKey, ResultKind, useProgress } from '../../../storage/progress';
import { useSettings } from '../../../storage/settings';
import { PathItem } from '../../components/PathItem';

/**
 * The voice's Song practice (PLAN.md milestone 6.6): the songs with words, easiest first, each
 * with its stars. Like the piano's, they're always open.
 */
export function VoiceSongsScreen() {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const results = useProgress((s) => s.results);
  const range = useSettings((s) => s.vocalRange);
  const starsOf = (id: string) => results[resultKey(ResultKind.VoiceSong, id)]?.bestStars ?? 0;

  return (
    <section className="screen">
      <h1>{t('songPractice.title')}</h1>
      <section className="card unit">
        <h2>{t('voiceSongs.heading')}</h2>
        <p className="muted">{t('voiceSongs.intro')}</p>
        {!range && (
          <p className="notice">
            {t('sing.noRange')} <Link to="/settings#voice">{t('tuner.findRange')}</Link>
          </p>
        )}
        <ol className="path">
          {VOICE_SONG_IDS.map((id) => {
            const stars = starsOf(id);
            return (
              <PathItem
                key={id}
                title={ts(`${id}.title`)}
                href={`/sing/${id}`}
                state={{
                  status: stars > 0 ? LessonStatus.Completed : LessonStatus.Available,
                  stars,
                }}
              />
            );
          })}
        </ol>
      </section>
    </section>
  );
}
