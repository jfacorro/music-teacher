import { useTranslation } from 'react-i18next';
import { LESSON_ORDER, SKILLS, UNITS, findLesson } from '../../content/courses';
import { skillProgress } from '../../content/skills';
import { isSongId } from '../../content/songs';
import { formatDate, formatPercent, formatPracticeTime } from '../../i18n/format';
import { useContentText } from '../../i18n/useContentText';
import {
  longestStreak,
  practicedDays,
  recentDays,
  resultKey,
  streakDays,
  totalPracticeMinutes,
  useProgress,
} from '../../storage/progress';
import { Stars } from '../components/Stars';

const RECENT_LIMIT = 10;
const CHART_DAYS = 14;
/** The day chart's scale reaches at least this far, so a short day doesn't fill a bar. */
const CHART_MIN_MS = 10 * 60_000;
const DATE_AND_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
const DAY_TITLE: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

export function ProgressScreen() {
  const { t, i18n } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const courseText = useContentText('courses');
  const results = useProgress((s) => s.results);
  const log = useProgress((s) => s.log);
  const days = useProgress((s) => s.days);

  const lessonResults = LESSON_ORDER.map((id) => results[resultKey('lesson', id)]);
  const completed = lessonResults.filter((result) => (result?.bestStars ?? 0) >= 1).length;
  const stars = lessonResults.reduce((sum, result) => sum + (result?.bestStars ?? 0), 0);
  const practiced = practicedDays(days);
  const streak = streakDays(practiced);
  const best = longestStreak(practiced);
  const minutes = totalPracticeMinutes(days);
  const skills = skillProgress(
    SKILLS,
    UNITS,
    (id) => results[resultKey('lesson', id)]?.bestAccuracy ?? null,
  );

  const time = (ms: number) =>
    ms > 0 && ms < 60_000
      ? t('progress.underMinute')
      : formatPracticeTime(ms / 60_000, i18n.language);

  const titleOf = (kind: 'lesson' | 'song', id: string) => {
    if (kind === 'song') return isSongId(id) ? ts(`${id}.title`) : id;
    const found = findLesson(id);
    return found ? courseText(`lessons.${id}`, found.lesson.titleVars) : id;
  };

  return (
    <section className="screen progress">
      <h1>{t('progress.title')}</h1>
      {log.length === 0 && practiced.length === 0 && <p>{t('progress.empty')}</p>}

      <div className="stat-grid">
        <Stat
          label={t('progress.lessons')}
          value={t('progress.outOf', { value: completed, total: LESSON_ORDER.length })}
        />
        <Stat
          label={t('progress.stars')}
          value={t('progress.outOf', { value: stars, total: LESSON_ORDER.length * 3 })}
        />
        <Stat
          label={t('progress.streak')}
          value={t('progress.days', { count: streak })}
          detail={best > streak ? t('progress.bestStreak', { count: best }) : undefined}
        />
        <Stat label={t('progress.time')} value={time(minutes * 60_000)} />
      </div>

      {practiced.length > 0 && <PracticeDays days={days} time={time} />}

      <section className="card">
        <h2>{t('progress.skills.heading')}</h2>
        <ul className="skills">
          {skills.map((skill) => (
            <li key={skill.skill} className={`skill skill--${skill.level}`}>
              <span className="skill__name">{courseText(`skills.${skill.skill}`)}</span>
              <span className="skill__meter" aria-hidden="true">
                <span style={{ inlineSize: `${Math.round(skill.mastery * 100)}%` }} />
              </span>
              <span className="skill__level">
                {t(`progress.skills.level.${skill.level}`)}
                {skill.level !== 'notStarted' && (
                  <span className="muted"> {formatPercent(skill.mastery, i18n.language)}</span>
                )}
              </span>
              <span className="muted skill__lessons">
                {t('progress.skills.lessons', { played: skill.played, total: skill.lessons })}
              </span>
            </li>
          ))}
        </ul>
      </section>

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

/** Practice time per day over the last two weeks, as bars. */
function PracticeDays({
  days,
  time,
}: {
  days: Readonly<Record<string, number>>;
  time: (ms: number) => string;
}) {
  const { t, i18n } = useTranslation('screens');
  const recent = recentDays(days, CHART_DAYS);
  const scale = Math.max(CHART_MIN_MS, ...recent.map((day) => day.ms));
  const total = recent.reduce((sum, day) => sum + day.ms, 0);
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });

  return (
    <section className="card">
      <h2>{t('progress.lastDays.heading')}</h2>
      <p className="muted">{t('progress.lastDays.total', { time: time(total) })}</p>
      <ol className="days">
        {recent.map(({ day, date, ms }, index) => {
          const label =
            ms > 0
              ? t('progress.lastDays.day', {
                  date: formatDate(date, i18n.language, DAY_TITLE),
                  time: time(ms),
                })
              : t('progress.lastDays.none', { date: formatDate(date, i18n.language, DAY_TITLE) });
          return (
            <li
              key={day}
              className={index === recent.length - 1 ? 'day is-today' : 'day'}
              title={label}
              aria-label={label}
            >
              <span className="day__bar">
                <span style={{ blockSize: ms > 0 ? `max(3px, ${(ms / scale) * 100}%)` : 0 }} />
              </span>
              <span className="day__name" aria-hidden="true">
                {weekday.format(date)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="muted stat__detail">{detail}</span>}
    </div>
  );
}
