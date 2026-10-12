import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { UNITS } from '../../content/courses';
import { SONG_IDS } from '../../content/songs';
import { useContentText } from '../../i18n/useContentText';

/** Units and their lessons in order, plus songs to practice. (Progress and locks: 1.7.) */
export function HomeScreen() {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const courseText = useContentText('courses');

  return (
    <section className="screen">
      <h1>{t('home.title')}</h1>
      <p>{t('home.intro')}</p>
      <p>
        <Link className="button" to="/settings">
          {t('home.checkKeyboard')}
        </Link>
      </p>

      {UNITS.map((unit, index) => (
        <section key={unit.id} className="card unit">
          <h2>
            {t('home.unit', {
              number: index + 1,
              title: courseText(`units.${unit.id}.title`, unit.textVars),
            })}
          </h2>
          <p className="muted">{courseText(`units.${unit.id}.description`, unit.textVars)}</p>
          <ol className="unit__lessons">
            {unit.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link to={`/lesson/${lesson.id}`}>
                  {courseText(`lessons.${lesson.id}`, lesson.titleVars)}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="card unit">
        <h2>{t('home.songs')}</h2>
        <p className="muted">{t('home.songsIntro')}</p>
        <ul className="unit__lessons song-list">
          {SONG_IDS.map((id) => (
            <li key={id}>
              <Link to={`/practice/${id}`}>{ts(`${id}.title`)}</Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
