import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Course, findLesson, nextLessonId, TheoryAnswer } from '../../../content/courses';
import { courseStates, tryItems, whyLesson } from '../../../content/courseLinks';
import { LessonStatus } from '../../../content/unlock';
import { useContentText } from '../../../i18n/useContentText';
import { resultKey, useProgress, ResultKind } from '../../../storage/progress';
import { useSettings } from '../../../storage/settings';
import { Stars } from '../../components/Stars';
import { KeyHint, ShortcutButton } from '../../components/ShortcutButton';
import { ShortcutKey, useShortcut } from '../../shortcuts';
import { type LessonVisit, useLessonVisit } from './lessonVisit';
import { TryItList } from './TryItList';

interface LessonCompleteProps {
  lessonId: string;
  /** Stars earned this time. */
  stars: number;
  onRestart: () => void;
}

export function LessonComplete({ lessonId, stars, onRestart }: LessonCompleteProps) {
  const { t } = useTranslation('screens');
  const courseText = useContentText('courses');
  const results = useProgress((s) => s.results);
  const practiced = useSettings((s) =>
    s.theoryAnswer === TheoryAnswer.Sing ? Course.Voice : Course.Piano,
  );
  const best = results[resultKey(ResultKind.Lesson, lessonId)]?.bestStars ?? stars;
  const { course, lesson } = findLesson(lessonId)!;
  const states = useMemo(
    () => courseStates((id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0),
    [results],
  );
  const next = nextLessonId(lessonId);
  const nextOpen = next !== null && states[course].get(next)?.status !== LessonStatus.Locked;
  const why = whyLesson(lessonId, states);
  const titleOf = (id: string) => courseText(`lessons.${id}`, findLesson(id)?.lesson.titleVars);
  const tries = tryItems(lesson, practiced, states);

  // Enter goes on: back where this lesson was opened from, to the next lesson, or to Learn when
  // it's locked or there's none.
  const { backTo } = useLessonVisit();
  const back = backTo !== undefined && findLesson(backTo) !== null ? backTo : null;
  const onward = back ? `/lesson/${back}` : nextOpen ? `/lesson/${next}` : '/learn';
  const visit: LessonVisit | undefined = back ? { finished: true } : undefined;
  const navigate = useNavigate();
  useShortcut(ShortcutKey.Enter, () => void navigate(onward, { state: visit }));

  return (
    <section className="results lesson__complete" aria-labelledby="lesson-complete">
      <h2 id="lesson-complete">{t(best >= 1 ? 'lesson.complete' : 'lesson.notComplete')}</h2>
      <Stars stars={stars} />
      {best > stars && <p className="muted">{t('lesson.bestStars', { stars: best })}</p>}
      {stars === 0 && <p className="muted">{t('lesson.noStars')}</p>}
      {why && (
        <p className="lesson__why muted">
          {t('lesson.why')}{' '}
          <Link to={`/lesson/${why}`} state={{ backTo: lessonId } satisfies LessonVisit}>
            {t('lesson.whyLink', { lesson: titleOf(why) })}
          </Link>
        </p>
      )}
      {tries.length > 0 && <TryItList items={tries} />}
      <div className="button-row results__actions">
        <ShortcutButton shortcut={ShortcutKey.Space} className="button" onClick={onRestart}>
          {t('lesson.restart')}
        </ShortcutButton>
        <Link
          className="button button--primary"
          to={onward}
          state={visit}
          aria-keyshortcuts={ShortcutKey.Enter}
        >
          {back
            ? t('lesson.backTo', { lesson: titleOf(back) })
            : nextOpen
              ? t('lesson.next')
              : t('lesson.backHome')}
          <KeyHint shortcut={ShortcutKey.Enter} />
        </Link>
      </div>
    </section>
  );
}
