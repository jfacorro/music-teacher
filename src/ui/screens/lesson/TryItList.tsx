import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Course, findLesson } from '../../../content/courses';
import { TryKind, type TryItem } from '../../../content/courseLinks';
import { useContentText } from '../../../i18n/useContentText';
import { chooseCourse } from '../../../storage/settings';
import { useEarLevelName } from '../earTraining/useEarLevelName';

/** Where an item leads. */
function hrefOf(item: TryItem): string {
  switch (item.kind) {
    case TryKind.Lesson:
      return `/lesson/${item.id}`;
    case TryKind.Song:
      return item.course === Course.Voice ? `/sing/${item.id}` : `/practice/${item.id}`;
    case TryKind.Ear:
      return `/ear-training?level=${item.id}`;
  }
}

/** A theory lesson's finished screen: where to put it to use, in the other courses. */
export function TryItList({ items }: { items: readonly TryItem[] }) {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const courseText = useContentText('courses');
  const earLevelName = useEarLevelName();

  const label = (item: TryItem): [title: string, kind: string] => {
    switch (item.kind) {
      case TryKind.Lesson: {
        const found = findLesson(item.id)!;
        return [
          courseText(`lessons.${item.id}`, found.lesson.titleVars),
          t(
            found.course === Course.Voice ? 'lesson.tryIt.voiceLesson' : 'lesson.tryIt.pianoLesson',
          ),
        ];
      }
      case TryKind.Song:
        return [ts(`${item.id}.title`), t('lesson.tryIt.song')];
      case TryKind.Ear:
        return [earLevelName(item.id), t('lesson.tryIt.ear')];
    }
  };

  return (
    <section className="try-it" aria-labelledby="try-it">
      <h3 id="try-it" className="muted">
        {t('lesson.tryIt.title')}
      </h3>
      <ul>
        {items.map((item) => {
          const [title, kind] = label(item);
          return (
            <li key={`${item.kind}:${item.id}`}>
              <Link
                to={hrefOf(item)}
                // A lesson switches to its course when it opens; songs and exercises don't.
                onClick={() => item.kind !== TryKind.Lesson && chooseCourse(item.course)}
              >
                <span>{title}</span>
                <span className="muted">{kind}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
