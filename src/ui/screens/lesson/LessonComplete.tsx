import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { COURSE_UNITS, findLesson, nextLessonId } from '../../../content/courses';
import { lessonStates, LessonStatus } from '../../../content/unlock';
import { resultKey, useProgress, ResultKind } from '../../../storage/progress';
import { Stars } from '../../components/Stars';
import { KeyHint, ShortcutButton } from '../../components/ShortcutButton';
import { ShortcutKey, useShortcut } from '../../shortcuts';

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
  // Enter goes on: to the next lesson, or back to Learn when it's locked or there's none.
  const onward = nextOpen ? `/lesson/${next}` : '/learn';
  const navigate = useNavigate();
  useShortcut(ShortcutKey.Enter, () => void navigate(onward));

  return (
    <section className="results lesson__complete" aria-labelledby="lesson-complete">
      <h2 id="lesson-complete">{t(best >= 1 ? 'lesson.complete' : 'lesson.notComplete')}</h2>
      <Stars stars={stars} />
      {best > stars && <p className="muted">{t('lesson.bestStars', { stars: best })}</p>}
      {stars === 0 && <p className="muted">{t('lesson.noStars')}</p>}
      <div className="button-row results__actions">
        <ShortcutButton shortcut={ShortcutKey.Space} className="button" onClick={onRestart}>
          {t('lesson.restart')}
        </ShortcutButton>
        <Link className="button button--primary" to={onward} aria-keyshortcuts={ShortcutKey.Enter}>
          {nextOpen ? t('lesson.next') : t('lesson.backHome')}
          <KeyHint shortcut={ShortcutKey.Enter} />
        </Link>
      </div>
    </section>
  );
}
