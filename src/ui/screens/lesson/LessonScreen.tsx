import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { findLesson } from '../../../content/courses';
import { lessonNamespace, loadLesson, type Lesson } from '../../../content/lessons';
import { i18n } from '../../../i18n';
import { LessonPlayer } from './LessonPlayer';
import { LoadStatus } from '../../loadStatus';
import { loadStepRuns } from '../../../storage/stepRuns';

type LoadState =
  | { status: typeof LoadStatus.Loading }
  | { status: typeof LoadStatus.Ready; lesson: Lesson }
  | { status: typeof LoadStatus.Error };

export function LessonScreen() {
  const { lessonId } = useParams();
  const { t } = useTranslation('screens');
  const found = lessonId ? findLesson(lessonId) : null;

  if (!lessonId || !found) {
    return (
      <section className="screen">
        <p className="notice notice--problem">{t('lesson.notFound')}</p>
        <Link to="/learn">{t('lesson.backHome')}</Link>
      </section>
    );
  }
  return <LessonLoader key={lessonId} lessonId={lessonId} />;
}

function LessonLoader({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation('screens');
  const [state, setState] = useState<LoadState>({ status: LoadStatus.Loading });

  useEffect(() => {
    let cancelled = false;
    // The lesson's text is its own namespace; load it alongside the lesson, and the earlier
    // tries of its steps so the lesson can open where it was left.
    Promise.all([
      loadLesson(lessonId),
      i18n.loadNamespaces(lessonNamespace(lessonId)),
      loadStepRuns(lessonId),
    ]).then(
      ([lesson]) => !cancelled && setState({ status: LoadStatus.Ready, lesson }),
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: LoadStatus.Error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (state.status === LoadStatus.Loading) return null;
  if (state.status === LoadStatus.Error) {
    return (
      <section className="screen">
        <p className="notice notice--problem">{t('lesson.loadError')}</p>
        <Link to="/learn">{t('lesson.backHome')}</Link>
      </section>
    );
  }
  return <LessonPlayer lesson={state.lesson} />;
}
