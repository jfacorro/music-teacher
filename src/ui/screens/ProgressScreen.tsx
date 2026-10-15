import { useTranslation } from 'react-i18next';
import { LESSON_ORDER, SKILLS, UNITS, findLesson } from '../../content/courses';
import { skillProgress, SkillLevel } from '../../content/skills';
import { isSongId } from '../../content/songs';
import { formatDate, formatPercent, formatPracticeTime } from '../../i18n/format';
import { useContentText } from '../../i18n/useContentText';
import {
  longestStreak,
  practicedDays,
  resultKey,
  streakDays,
  totalPracticeMinutes,
  useProgress,
  ResultKind,
} from '../../storage/progress';
import { Stars } from '../components/Stars';
import { StarsSize } from '../components/starsSize';
import { ActivityCalendar } from './ActivityCalendar';

const RECENT_LIMIT = 10;
const DATE_AND_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

export function ProgressScreen() {
  const { t, i18n } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const courseText = useContentText('courses');
  const results = useProgress((s) => s.results);
  const log = useProgress((s) => s.log);
  const days = useProgress((s) => s.days);

  const lessonResults = LESSON_ORDER.map((id) => results[resultKey(ResultKind.Lesson, id)]);
  const completed = lessonResults.filter((result) => (result?.bestStars ?? 0) >= 1).length;
  const stars = lessonResults.reduce((sum, result) => sum + (result?.bestStars ?? 0), 0);
  const practiced = practicedDays(days);
  const streak = streakDays(practiced);
  const best = longestStreak(practiced);
  const minutes = totalPracticeMinutes(days);
  const skills = skillProgress(
    SKILLS,
    UNITS,
    (id) => results[resultKey(ResultKind.Lesson, id)]?.bestAccuracy ?? null,
  );

  const time = (ms: number) =>
    ms > 0 && ms < 60_000
      ? t('progress.underMinute')
      : formatPracticeTime(ms / 60_000, i18n.language);

  const titleOf = (kind: ResultKind, id: string) => {
    if (kind === ResultKind.Song) return isSongId(id) ? ts(`${id}.title`) : id;
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

      <ActivityCalendar days={days} time={time} />

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
                {skill.level !== SkillLevel.NotStarted && (
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
                      <Stars stars={entry.stars} size={StarsSize.Small} />
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

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="muted stat__detail">{detail}</span>}
    </div>
  );
}
