import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Course, COURSE_UNITS, lessonOrder, unitsByLevel } from '../../content/courses';
import {
  isUnitFinished,
  isUnitOpen,
  lessonStates,
  nextLessonToPlay,
  LessonStatus,
} from '../../content/unlock';
import { MAX_STARS } from '../../engine/scoring';
import { useContentText } from '../../i18n/useContentText';
import { resultKey, useProgress, ResultKind } from '../../storage/progress';
import { useSettings } from '../../storage/settings';
import { IndexedPage, type IndexGroup } from '../components/IndexedPage';
import { PathItem } from '../components/PathItem';

const CHECK = '✓';
const STAR = '★';
const CHEVRON = '▸';

/**
 * The learning path of the course being practiced: what to do next, and every unit's lessons
 * with stars and locks, under their levels (Beginner, Elementary…).
 */
export function HomeScreen() {
  const { t } = useTranslation('screens');
  const courseText = useContentText('courses');
  const results = useProgress((s) => s.results);
  const course = useSettings((s) => s.course);
  const units = COURSE_UNITS[course];
  const levels = useMemo(() => unitsByLevel(units), [units]);

  const states = useMemo(
    () => lessonStates(units, (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0),
    [units, results],
  );
  const nextId = nextLessonToPlay(units, states);
  const nextLesson = nextId ? units.flatMap((u) => u.lessons).find((l) => l.id === nextId) : null;
  const started = lessonOrder(course).some((id) => results[resultKey(ResultKind.Lesson, id)]);
  const groups: IndexGroup[] = [
    { items: [{ id: 'next', label: started ? t('home.continueLabel') : t('home.startLabel') }] },
    ...levels.map(({ level, units: inLevel }) => ({
      heading: t(`course.levels.${level}`),
      items: inLevel.map(({ unit, number }) => ({
        id: `unit-${unit.id}`,
        label: t('course.unitShort', {
          number,
          title: courseText(`units.${unit.id}.title`, unit.textVars),
        }),
      })),
    })),
  ];

  return (
    <section className="screen">
      <h1>{t('home.title')}</h1>
      <IndexedPage groups={groups}>
        <section className="card continue" id="next">
          {nextLesson ? (
            <>
              <p className="muted">{started ? t('home.continueLabel') : t('home.startLabel')}</p>
              <h2>{courseText(`lessons.${nextLesson.id}`, nextLesson.titleVars)}</h2>
              <div className="button-row">
                <Link className="button button--primary" to={`/lesson/${nextLesson.id}`}>
                  {started ? t('home.continue') : t('home.start')}
                </Link>
                {course === Course.Voice ? (
                  <Link className="button" to="/settings#voice">
                    {t('home.checkRange')}
                  </Link>
                ) : (
                  <Link className="button" to="/settings">
                    {t('home.checkKeyboard')}
                  </Link>
                )}
              </div>
            </>
          ) : (
            <p>{t('home.allDone')}</p>
          )}
        </section>

        {levels.map(({ level, units: inLevel }) => (
          <section key={level} className="level" aria-labelledby={`level-${level}`}>
            <h2 id={`level-${level}`} className="level__heading">
              {inLevel.length === 1
                ? t('course.levelHeadingOne', {
                    level: t(`course.levels.${level}`),
                    number: inLevel[0]!.number,
                  })
                : t('course.levelHeading', {
                    level: t(`course.levels.${level}`),
                    first: inLevel[0]!.number,
                    last: inLevel.at(-1)!.number,
                  })}
            </h2>
            {inLevel.map(({ unit, number }) => {
              const open = isUnitOpen(unit, states);
              const finished = isUnitFinished(unit, states);
              const done = unit.lessons.filter(
                (l) => states.get(l.id)?.status === LessonStatus.Completed,
              ).length;
              const title = t('home.unit', {
                number,
                title: courseText(`units.${unit.id}.title`, unit.textVars),
              });
              const progress = t('home.unitProgress', { done, total: unit.lessons.length });
              const contents = (
                <>
                  <p className="muted">
                    {courseText(`units.${unit.id}.description`, unit.textVars)}
                  </p>
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
                  <section key={unit.id} id={`unit-${unit.id}`} className="card unit">
                    <header className="unit__header">
                      <h3 className="unit__title">{title}</h3>
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
                <details
                  key={unit.id}
                  id={`unit-${unit.id}`}
                  className={open ? 'card unit' : 'card unit is-locked'}
                >
                  <summary className="unit__header unit__summary" title={t('home.unitToggle')}>
                    <span className="unit__chevron" aria-hidden="true">
                      {CHEVRON}
                    </span>
                    <h3 className="unit__title">{title}</h3>
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
          </section>
        ))}
      </IndexedPage>
    </section>
  );
}
