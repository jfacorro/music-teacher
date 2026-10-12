import { useTranslation } from 'react-i18next';
import { LESSON_ORDER, findLesson } from '../../content/courses';
import { isSongId } from '../../content/songs';
import { formatDate, formatPercent, formatPracticeTime } from '../../i18n/format';
import { useContentText } from '../../i18n/useContentText';
import { resultKey, streakDays, totalPracticeMinutes, useProgress } from '../../storage/progress';
import { Stars } from '../components/Stars';

const RECENT_LIMIT = 10;
const DATE_AND_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

export function ProgressScreen() {
  const { t, i18n } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const courseText = useContentText('courses');
  const results = useProgress((s) => s.results);
  const log = useProgress((s) => s.log);

  const lessonResults = LESSON_ORDER.map((id) => results[resultKey('lesson', id)]);
  const completed = lessonResults.filter((result) => (result?.bestStars ?? 0) >= 1).length;
  const stars = lessonResults.reduce((sum, result) => sum + (result?.bestStars ?? 0), 0);
  const streak = streakDays(log);
  const minutes = totalPracticeMinutes(log);

  const titleOf = (kind: 'lesson' | 'song', id: string) => {
    if (kind === 'song') return isSongId(id) ? ts(`${id}.title`) : id;
    const found = findLesson(id);
    return found ? courseText(`lessons.${id}`, found.lesson.titleVars) : id;
  };

  return (
    <section className="screen">
      <h1>{t('progress.title')}</h1>
      {log.length === 0 && <p>{t('progress.empty')}</p>}

      <div className="stat-grid">
        <Stat
          label={t('progress.lessons')}
          value={t('progress.outOf', { value: completed, total: LESSON_ORDER.length })}
        />
        <Stat
          label={t('progress.stars')}
          value={t('progress.outOf', { value: stars, total: LESSON_ORDER.length * 3 })}
        />
        <Stat label={t('progress.streak')} value={t('progress.days', { count: streak })} />
        <Stat
          label={t('progress.time')}
          value={
            minutes > 0 && minutes < 1
              ? t('progress.underMinute')
              : formatPracticeTime(minutes, i18n.language)
          }
        />
      </div>

      {log.length > 0 && (
        <section className="card">
          <h2>{t('progress.recent')}</h2>
          <table className="events">
            <tbody>
              {[...log]
                .reverse()
                .slice(0, RECENT_LIMIT)
                .map((entry) => (
                  <tr key={entry.id ?? entry.at}>
                    <td className="muted">
                      {formatDate(new Date(entry.at), i18n.language, DATE_AND_TIME)}
                    </td>
                    <td>{titleOf(entry.kind, entry.refId)}</td>
                    <td>
                      <Stars stars={entry.stars} size="small" />
                    </td>
                    <td className="muted">{formatPercent(entry.accuracy, i18n.language)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
