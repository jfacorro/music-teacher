import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SONG_IDS } from '../../content/songs';
import { LessonStatus } from '../../content/unlock';
import { useMySongs } from '../../storage/mySongs';
import { resultKey, ResultKind, useProgress } from '../../storage/progress';
import { PathItem } from '../components/PathItem';

/** Song practice: the built-in songs and the learner's own (imported) songs, with their stars. */
export function SongsScreen() {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const results = useProgress((s) => s.results);
  const mySongs = useMySongs((s) => s.songs);
  const starsOf = (kind: ResultKind, id: string) => results[resultKey(kind, id)]?.bestStars ?? 0;
  const stateOf = (stars: number) => ({
    status: stars > 0 ? LessonStatus.Completed : LessonStatus.Available,
    stars,
  });

  return (
    <section className="screen">
      <h1>{t('songPractice.title')}</h1>

      <section className="card unit">
        <h2>{t('songPractice.songs')}</h2>
        <p className="muted">{t('songPractice.songsIntro')}</p>
        <ol className="path">
          {SONG_IDS.map((id) => (
            <PathItem
              key={id}
              title={ts(`${id}.title`)}
              href={`/practice/${id}`}
              state={stateOf(starsOf(ResultKind.Song, id))}
            />
          ))}
        </ol>
      </section>

      <section className="card unit">
        <h2>{t('songPractice.mySongs')}</h2>
        <p className="muted">
          {mySongs.length > 0 ? t('songPractice.mySongsIntro') : t('songPractice.mySongsEmpty')}
        </p>
        {mySongs.length > 0 && (
          <ol className="path">
            {mySongs.map((song) => (
              <PathItem
                key={song.id}
                title={song.title}
                href={`/practice/my/${song.id}`}
                state={stateOf(starsOf(ResultKind.MySong, String(song.id)))}
              />
            ))}
          </ol>
        )}
        <div className="button-row unit__actions">
          <Link className="button" to="/my-songs/import">
            {t('songPractice.importSong')}
          </Link>
        </div>
      </section>
    </section>
  );
}
