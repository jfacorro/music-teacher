import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { UNITS, unitsByLevel } from '../../content/courses';
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
import { IndexedPage, type IndexGroup } from '../components/IndexedPage';
import { PathItem } from '../components/PathItem';

const CHECK = '✓';
const STAR = '★';
const CHEVRON = '▸';

const LEVELS = unitsByLevel();

/**
 * The learning path: what to do next, and every unit's lessons with stars and locks, under
 * their levels (Beginner, Elementary…).
 */
export function HomeScreen() {
  const { t } = useTranslation('screens');
  const courseText = useContentText('courses');
  const results = useProgress((s) => s.results);

  const states = useMemo(
    () => lessonStates(UNITS, (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0),
    [results],
  );
  const nextId = nextLessonToPlay(UNITS, states);
  const nextLesson = nextId ? UNITS.flatMap((u) => u.lessons).find((l) => l.id === nextId) : null;
  const started = Object.keys(results).some((key) => key.startsWith('lesson:'));
  const groups: IndexGroup[] = [
    { items: [{ id: 'next', label: started ? t('home.continueLabel') : t('home.startLabel') }] },
    ...LEVELS.map(({ level, units }) => ({
      heading: t(`course.levels.${level}`),
      items: units.map(({ unit, number }) => ({
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
                <Link className="button" to="/settings">
                  {t('home.checkKeyboard')}
                </Link>
              </div>
            </>
          ) : (
            <p>{t('home.allDone')}</p>
          )}
        </section>

        {LEVELS.map(({ level, units }) => (
          <section key={level} className="level" aria-labelledby={`level-${level}`}>
            <h2 id={`level-${level}`} className="level__heading">
              {t('course.levelHeading', {
                level: t(`course.levels.${level}`),
                first: units[0]!.number,
                last: units.at(-1)!.number,
              })}
            </h2>
            {units.map(({ unit, number }) => {
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
