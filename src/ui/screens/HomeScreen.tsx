import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { UNITS } from '../../content/courses';
import { SONG_IDS } from '../../content/songs';
import {
  isUnitFinished,
  isUnitOpen,
  lessonStates,
  nextLessonToPlay,
  type LessonState,
  LessonStatus,
} from '../../content/unlock';
import { MAX_STARS } from '../../engine/scoring';
import { useContentText } from '../../i18n/useContentText';
import { useMySongs } from '../../storage/mySongs';
import { resultKey, useProgress, ResultKind } from '../../storage/progress';
import { Stars } from '../components/Stars';
import { StarsSize } from '../components/starsSize';

const CHECK = '✓';
const STAR = '★';
const CHEVRON = '▸';

/**
 * The learning path: what to do next, every unit's lessons with stars and locks, songs, and the
 * learner's own songs.
 */
export function HomeScreen() {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const courseText = useContentText('courses');
  const results = useProgress((s) => s.results);

  const states = useMemo(
    () => lessonStates(UNITS, (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0),
    [results],
  );
  const nextId = nextLessonToPlay(UNITS, states);
  const nextLesson = nextId ? UNITS.flatMap((u) => u.lessons).find((l) => l.id === nextId) : null;
  const started = Object.keys(results).some((key) => key.startsWith('lesson:'));
  const songStars = (id: string) => results[resultKey(ResultKind.Song, id)]?.bestStars ?? 0;
  const mySongs = useMySongs((s) => s.songs);
  const mySongStars = (id: number) =>
    results[resultKey(ResultKind.MySong, String(id))]?.bestStars ?? 0;

  return (
    <section className="screen">
      <h1>{t('home.title')}</h1>

      <section className="card continue">
        {nextLesson ? (
          <>
            <p className="muted">{started ? t('home.continueLabel') : t('home.startLabel')}</p>
            <h2>{courseText(`lessons.${nextLesson.id}`, nextLesson.titleVars)}</h2>
            <div className="button-row">
              <Link className="button button--primary" to={`/lesson/${nextLesson.id}`}>
                {started ? t('home.continue') : t('home.start')}
              </Link>
              <Link className="button" to="/settings">
                {t('home.checkKeyboard')}
              </Link>
            </div>
          </>
        ) : (
          <p>{t('home.allDone')}</p>
        )}
      </section>

      {UNITS.map((unit, index) => {
        const open = isUnitOpen(unit, states);
        const finished = isUnitFinished(unit, states);
        const done = unit.lessons.filter(
          (l) => states.get(l.id)?.status === LessonStatus.Completed,
        ).length;
        const title = t('home.unit', {
          number: index + 1,
          title: courseText(`units.${unit.id}.title`, unit.textVars),
        });
        const progress = t('home.unitProgress', { done, total: unit.lessons.length });
        const contents = (
          <>
            <p className="muted">{courseText(`units.${unit.id}.description`, unit.textVars)}</p>
            <ol className="path">
              {unit.lessons.map((lesson) => (
                <PathItem
                  key={lesson.id}
                  title={courseText(`lessons.${lesson.id}`, lesson.titleVars)}
                  href={`/lesson/${lesson.id}`}
                  state={states.get(lesson.id)!}
                  current={lesson.id === nextId}
                />
              ))}
            </ol>
          </>
        );

        // Units in progress stay open; finished and locked ones fold to one line, which opens
        // them (e.g. to replay a lesson for more stars).
        if (open && !finished) {
          return (
            <section key={unit.id} className="card unit">
              <header className="unit__header">
                <h2>{title}</h2>
                <span className="muted">{progress}</span>
              </header>
              {contents}
            </section>
          );
        }
        const stars = unit.lessons.reduce(
          (sum, lesson) => sum + (states.get(lesson.id)?.stars ?? 0),
          0,
        );
        return (
          <details key={unit.id} className={open ? 'card unit' : 'card unit is-locked'}>
            <summary className="unit__header unit__summary" title={t('home.unitToggle')}>
              <span className="unit__chevron" aria-hidden="true">
                {CHEVRON}
              </span>
              <h2>{title}</h2>
              <span className="unit__status muted">
                {finished && <span aria-hidden="true">{CHECK}</span>}
                <span>{progress}</span>
                {finished && (
                  <span>
                    <span aria-hidden="true">{STAR}</span>{' '}
                    {t('home.unitStars', { stars, total: unit.lessons.length * MAX_STARS })}
                  </span>
                )}
              </span>
              {!open && unit.unlock && (
                <span className="notice unit__lock">
                  {t('home.unitLocked', { stars: unit.unlock.previousUnitMinStars })}
                </span>
              )}
            </summary>
            {contents}
          </details>
        );
      })}

      <section className="card unit">
        <h2>{t('home.songs')}</h2>
        <p className="muted">{t('home.songsIntro')}</p>
        <ol className="path">
          {SONG_IDS.map((id) => {
            const stars = songStars(id);
            return (
              <PathItem
                key={id}
                title={ts(`${id}.title`)}
                href={`/practice/${id}`}
                state={{
                  status: stars > 0 ? LessonStatus.Completed : LessonStatus.Available,
                  stars,
                }}
              />
            );
          })}
        </ol>
      </section>

      <section className="card unit">
        <h2>{t('home.mySongs')}</h2>
        <p className="muted">
          {mySongs.length > 0 ? t('home.mySongsIntro') : t('home.mySongsEmpty')}
        </p>
        {mySongs.length > 0 && (
          <ol className="path">
            {mySongs.map((song) => {
              const stars = mySongStars(song.id);
              return (
                <PathItem
                  key={song.id}
                  title={song.title}
                  href={`/practice/my/${song.id}`}
                  state={{
                    status: stars > 0 ? LessonStatus.Completed : LessonStatus.Available,
                    stars,
                  }}
                />
              );
            })}
          </ol>
        )}
        <div className="button-row unit__actions">
          <Link className="button" to="/my-songs/import">
            {t('home.importSong')}
          </Link>
        </div>
      </section>
    </section>
  );
}

function PathItem({
  title,
  href,
  state,
  current = false,
}: {
  title: string;
  href: string;
  state: LessonState;
  current?: boolean;
}) {
  const { t } = useTranslation('screens');
  const className = `path__item path__item--${state.status}${current ? ' is-current' : ''}`;
  return (
    <li className={className}>
      <span className="path__marker" aria-hidden="true">
        {state.status === LessonStatus.Completed ? (
          CHECK
        ) : state.status === LessonStatus.Locked ? (
          <LockIcon />
        ) : null}
      </span>
      {state.status === LessonStatus.Locked ? (
        <span className="path__title">
          {title}
          <span className="visually-hidden">{t('home.locked')}</span>
        </span>
      ) : (
        <Link className="path__title" to={href}>
          {title}
        </Link>
      )}
      {state.stars > 0 && <Stars stars={state.stars} size={StarsSize.Small} />}
    </li>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
      <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 6H6V4.5a2 2 0 1 1 4 0V7Z" />
    </svg>
  );
}
