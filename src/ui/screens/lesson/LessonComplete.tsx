import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { nextLessonId } from '../../../content/courses';
import type { Lesson } from '../../../content/lessons';

const STAR = '★';
const EMPTY_STAR = '☆';

interface LessonCompleteProps {
  lesson: Lesson;
  /** Stars per graded step (find and exercise steps); skipped steps have none. */
  stars: ReadonlyMap<number, number>;
  onRestart: () => void;
}

/** End of a lesson: its stars are those of the weakest graded step (skipped = none). */
export function LessonComplete({ lesson, stars, onRestart }: LessonCompleteProps) {
  const { t } = useTranslation('screens');
  const graded = lesson.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.type !== 'explain');
  const earned =
    graded.length === 0 ? 3 : Math.min(...graded.map(({ index }) => stars.get(index) ?? 0));
  const next = nextLessonId(lesson.id);

  return (
    <section className="results lesson__complete" aria-labelledby="lesson-complete">
      <h2 id="lesson-complete">{t('lesson.complete')}</h2>
      <p className="results__stars" aria-label={t('practice.results.stars', { stars: earned })}>
        {STAR.repeat(earned) + EMPTY_STAR.repeat(3 - earned)}
      </p>
      {earned === 0 && graded.length > 0 && <p className="muted">{t('lesson.noStars')}</p>}
      <div className="button-row results__actions">
        <button type="button" className="button" onClick={onRestart}>
          {t('lesson.restart')}
        </button>
        {next ? (
          <Link className="button button--primary" to={`/lesson/${next}`}>
            {t('lesson.next')}
          </Link>
        ) : (
          <Link className="button button--primary" to="/">
            {t('lesson.backHome')}
          </Link>
        )}
      </div>
    </section>
  );
}
