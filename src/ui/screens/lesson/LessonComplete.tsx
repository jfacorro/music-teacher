import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { COURSE_UNITS, findLesson, nextLessonId } from '../../../content/courses';
import { lessonStates, LessonStatus } from '../../../content/unlock';
import { resultKey, useProgress, ResultKind } from '../../../storage/progress';
import { Stars } from '../../components/Stars';

interface LessonCompleteProps {
  lessonId: string;
  /** Stars earned this time. */
  stars: number;
  onRestart: () => void;
}

export function LessonComplete({ lessonId, stars, onRestart }: LessonCompleteProps) {
  const { t } = useTranslation('screens');
  const results = useProgress((s) => s.results);
  const best = results[resultKey(ResultKind.Lesson, lessonId)]?.bestStars ?? stars;
  const next = nextLessonId(lessonId);
  const states = lessonStates(
    COURSE_UNITS[findLesson(lessonId)!.course],
    (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0,
  );
  const nextOpen = next !== null && states.get(next)?.status !== LessonStatus.Locked;

  return (
    <section className="results lesson__complete" aria-labelledby="lesson-complete">
      <h2 id="lesson-complete">{t('lesson.complete')}</h2>
      <Stars stars={stars} />
      {best > stars && <p className="muted">{t('lesson.bestStars', { stars: best })}</p>}
      {stars === 0 && <p className="muted">{t('lesson.noStars')}</p>}
      <div className="button-row results__actions">
        <button type="button" className="button" onClick={onRestart}>
          {t('lesson.restart')}
        </button>
        {nextOpen ? (
          <Link className="button button--primary" to={`/lesson/${next}`}>
            {t('lesson.next')}
          </Link>
        ) : (
          <Link className="button button--primary" to="/learn">
            {t('lesson.backHome')}
          </Link>
        )}
      </div>
    </section>
  );
}
