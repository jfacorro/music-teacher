import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { unitsByLevel } from '../../content/courses';
import { SONG_IDS, SONG_UNITS } from '../../content/songs';
import { useContentText } from '../../i18n/useContentText';
import { LessonStatus } from '../../content/unlock';
import { useMySongs } from '../../storage/mySongs';
import { resultKey, ResultKind, useProgress } from '../../storage/progress';
import { PathItem } from '../components/PathItem';

/** The built-in songs by level, then by the unit that teaches them, in course order. */
const SONGS_BY_LEVEL = unitsByLevel()
  .map(({ level, units }) => ({
    level,
    first: units[0]!.number,
    last: units.at(-1)!.number,
    units: units
      .map(({ unit, number }) => ({
        unit,
        number,
        songs: SONG_IDS.filter((id) => SONG_UNITS[id] === unit.id),
      }))
      .filter(({ songs }) => songs.length > 0),
  }))
  .filter(({ units }) => units.length > 0);

/**
 * Song practice: the built-in songs, by the unit they belong to, and the learner's own
 * (imported) songs, with their stars.
 */
export function SongsScreen() {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const courseText = useContentText('courses');
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
        {SONGS_BY_LEVEL.map(({ level, first, last, units }) => (
          <section key={level} className="songs__group">
            <h3>{t('course.levelHeading', { level: t(`course.levels.${level}`), first, last })}</h3>
            {units.map(({ unit, number, songs }) => (
              <section key={unit.id} className="songs__level">
                <h4>
                  {t('songPractice.level', {
                    number,
                    unit: courseText(`units.${unit.id}.title`, unit.textVars),
                  })}
                </h4>
                <ol className="path">
                  {songs.map((id) => (
                    <PathItem
                      key={id}
                      title={ts(`${id}.title`)}
                      href={`/practice/${id}`}
                      state={stateOf(starsOf(ResultKind.Song, id))}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </section>
        ))}
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
