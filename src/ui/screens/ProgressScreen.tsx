import { useTranslation } from 'react-i18next';
import { MAX_STARS, STAR_THRESHOLDS } from '../../engine/scoring';
import { LESSON_ORDER, SKILLS, UNITS, findLesson } from '../../content/courses';
import { lessonStates, nextLessonToPlay } from '../../content/unlock';
import { SKILL_AREAS, SkillArea, skillProgress, SkillLevel } from '../../content/skills';
import { isSongId } from '../../content/songs';
import { useMySongs } from '../../storage/mySongs';
import { formatDate, formatPercent, formatPracticeTime } from '../../i18n/format';
import { useContentText } from '../../i18n/useContentText';
import { isValueOf } from '../../lib/values';
import { DrillLevel } from '../../content/sightReading';
import { useDrillLevelName } from './sightReading/useDrillLevelName';
import { EarLevel } from '../../content/earTraining';
import { useEarLevelName } from './earTraining/useEarLevelName';
import {
  exerciseAccuracies,
  longestStreak,
  practicedDays,
  resultKey,
  streakDays,
  useProgress,
  ResultKind,
} from '../../storage/progress';
import { Stars } from '../components/Stars';
import { StarsSize } from '../components/starsSize';
import { ActivityCalendar } from './ActivityCalendar';
import { TodayCard } from './TodayCard';
import { IndexedPage } from '../components/IndexedPage';

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
  // The level of the unit being worked on: the next lesson's (the last unit's once all is done).
  const states = lessonStates(
    UNITS,
    (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0,
  );
  const next = nextLessonToPlay(UNITS, states);
  const unitIndex = Math.max(
    0,
    next ? UNITS.findIndex((unit) => unit.lessons.some((l) => l.id === next)) : UNITS.length - 1,
  );
  const currentUnit = UNITS[unitIndex]!;
  const skills = skillProgress(
    SKILLS,
    UNITS,
    (id) => results[resultKey(ResultKind.Lesson, id)]?.bestAccuracy ?? null,
    exerciseAccuracies(log),
  );
  const [oneStar, twoStars, threeStars] = STAR_THRESHOLDS.map((threshold) =>
    formatPercent(threshold, i18n.language),
  );
  const starsTip = t('progress.skills.starsTip', { oneStar, twoStars, threeStars });
  const levelName = useDrillLevelName();
  const earLevelName = useEarLevelName();

  const time = (ms: number) =>
    ms > 0 && ms < 60_000
      ? t('progress.underMinute')
      : formatPracticeTime(ms / 60_000, i18n.language);

  const mySongs = useMySongs((s) => s.songs);

  const titleOf = (kind: ResultKind, id: string) => {
    if (kind === ResultKind.Song) return isSongId(id) ? ts(`${id}.title`) : id;
    if (kind === ResultKind.Drill) {
      return isValueOf(DrillLevel, id)
        ? t('sightReading.logTitle', { level: levelName(id) })
        : t('sightReading.title');
    }
    if (kind === ResultKind.Ear) {
      return isValueOf(EarLevel, id)
        ? t('earTraining.logTitle', { level: earLevelName(id) })
        : t('earTraining.title');
    }
    if (kind === ResultKind.MySong) {
      return mySongs.find((song) => String(song.id) === id)?.title ?? t('progress.deletedSong');
    }
    const found = findLesson(id);
    return found ? courseText(`lessons.${id}`, found.lesson.titleVars) : id;
  };

  return (
    <section className="screen progress">
      {/* A greeting: back for anyone who has practiced. */}
      <h1>
        {log.length > 0 || practiced.length > 0 ? t('progress.welcomeBack') : t('progress.welcome')}
      </h1>
      <IndexedPage
        groups={[
          {
            items: [
              { id: 'activity', label: t('progress.activity.heading') },
              { id: 'today', label: t('today.title') },
              { id: 'skills', label: t('progress.skills.heading') },
              { id: 'recent', label: t('progress.recent') },
            ],
          },
        ]}
      >
        <ActivityCalendar days={days} time={time} streak={streak} best={best} />
        <TodayCard />
        {log.length === 0 && practiced.length === 0 && <p>{t('progress.empty')}</p>}

        {/* Where you are in the course, on one line. */}
        <section className="card course-line">
          <h2 className="course-line__title">{t('progress.course')}</h2>
          <span className="course-line__facts">
            <span>{t(`course.levels.${currentUnit.level}`)}</span>
            <span>{t('progress.levelDetail', { number: unitIndex + 1, total: UNITS.length })}</span>
            <span>{t('progress.lessonsOf', { value: completed, total: LESSON_ORDER.length })}</span>
            <span>
              {t('progress.starsOf', { value: stars, total: LESSON_ORDER.length * MAX_STARS })}
            </span>
          </span>
          <span className="course-line__meter" aria-hidden="true">
            <span style={{ inlineSize: `${(completed / LESSON_ORDER.length) * 100}%` }} />
          </span>
        </section>

        <section className="card" id="skills">
          <h2>{t('progress.skills.heading')}</h2>
          {/* The star levels, labeled once over the lines that mark them on every bar. */}
          <div className="skill skill-stars">
            <span />
            <span className="skill-stars__labels" aria-hidden="true">
              {STAR_THRESHOLDS.map((threshold, i) => (
                <span
                  key={threshold}
                  className="skill-stars__label"
                  // On hover, just the accuracy that level needs.
                  title={formatPercent(threshold, i18n.language)}
                  style={{ insetInlineStart: `${threshold * 100}%` }}
                >
                  {'★'.repeat(i + 1)}
                </span>
              ))}
            </span>
            <span className="visually-hidden">{starsTip}</span>
          </div>
          {Object.values(SkillArea).map((area) => (
            <div key={area} className="skill-area">
              <h3 className="skill-area__heading">{t(`progress.skills.areas.${area}`)}</h3>
              <ul className="skills">
                {skills
                  .filter((skill) => SKILL_AREAS[area].includes(skill.skill))
                  .map((skill) => {
                    const started = skill.level !== SkillLevel.NotStarted;
                    // The level and lessons played: on hover, and for screen readers.
                    const detail = t('progress.skills.detail', {
                      level: t(`progress.skills.level.${skill.level}`),
                      played:
                        skill.lessons > 0
                          ? t('progress.skills.lessons', {
                              played: skill.played,
                              total: skill.lessons,
                            })
                          : t('progress.skills.exercises', { count: skill.played }),
                    });
                    return (
                      <li
                        key={skill.skill}
                        className={`skill skill--${skill.level}`}
                        title={detail}
                      >
                        <span className="skill__name">{courseText(`skills.${skill.skill}`)}</span>
                        <span className="skill__bar" aria-hidden="true">
                          {started && (
                            <span
                              className="skill__fill"
                              style={{ inlineSize: `${Math.round(skill.mastery * 100)}%` }}
                            />
                          )}
                          {/* The 1, 2 and 3-star levels. */}
                          {STAR_THRESHOLDS.map((threshold) => (
                            <span
                              key={threshold}
                              className="skill__tick"
                              style={{ insetInlineStart: `${threshold * 100}%` }}
                            />
                          ))}
                        </span>
                        <span className="skill__value">
                          {started ? formatPercent(skill.mastery, i18n.language) : '—'}
                        </span>
                        <span className="visually-hidden">{detail}</span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          <ul className="skills-legend">
            {Object.values(SkillLevel).map((level) => (
              <li key={level} className={`skill--${level}`}>
                <span className="skills-legend__swatch" aria-hidden="true" />
                {t(`progress.skills.level.${level}`)}
              </li>
            ))}
          </ul>
        </section>

        {log.length > 0 && (
          <section className="card" id="recent">
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
      </IndexedPage>
    </section>
  );
}
