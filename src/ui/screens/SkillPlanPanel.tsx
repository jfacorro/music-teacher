import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { starsFor } from '../../engine/scoring';
import { findLesson, type Skill } from '../../content/courses';
import { type SkillPlan, SkillStep } from '../../content/skills';
import { formatPercent } from '../../i18n/format';
import { useContentText } from '../../i18n/useContentText';
import { EXERCISE_RUNS } from '../../storage/progress';
import { Stars } from '../components/Stars';
import { StarsSize } from '../components/starsSize';

/** Where a skill practiced by exercises of its own is practiced. */
const EXERCISE_PAGES: Partial<Readonly<Record<Skill, string>>> = {
  'sight-reading': '/sight-reading',
  'ear-training': '/ear-training',
  'singing-by-ear': '/ear-training',
  'sight-singing': '/sight-singing',
};

/**
 * A skill opened on Home › Skills: what raises it. Its lessons, with what each can add at three
 * stars and a button to play it; the few that reach the next level come first, in bold.
 */
export function SkillPlanPanel({ id, skill, plan }: { id: string; skill: Skill; plan: SkillPlan }) {
  const { t, i18n } = useTranslation('screens');
  const courseText = useContentText('courses');
  const percent = (value: number) => formatPercent(value, i18n.language);
  const level = plan.next && t(`progress.skills.level.${plan.next}`);
  const open = plan.lessons.filter(
    (lesson) => lesson.step === SkillStep.Play || lesson.step === SkillStep.Redo,
  );
  const shown = plan.lessons.filter((lesson) => lesson.step !== SkillStep.Locked);
  const lockedUnits = [
    ...new Set(
      plan.lessons.filter((lesson) => lesson.step === SkillStep.Locked).map((l) => l.unit),
    ),
  ];
  const locked = plan.lessons.length - shown.length;
  const exercisePage = EXERCISE_PAGES[skill];
  const stepName: Readonly<Record<SkillStep, string>> = {
    [SkillStep.Play]: t('progress.skills.plan.steps.play'),
    [SkillStep.Redo]: t('progress.skills.plan.steps.redo'),
    [SkillStep.Done]: t('progress.skills.plan.steps.done'),
    [SkillStep.Locked]: '',
  };

  return (
    <div className="skill-plan" id={id}>
      {exercisePage && (
        <p className="skill-plan__goal">
          {t('progress.skills.plan.exercises', { max: EXERCISE_RUNS })}{' '}
          <Link className="button skill-plan__play" to={exercisePage}>
            {t('progress.skills.plan.practice')}
          </Link>
        </p>
      )}
      {plan.lessons.length > 0 && (
        <p className="skill-plan__goal">
          {!level
            ? t('progress.skills.plan.mastered')
            : plan.needed > 0
              ? t('progress.skills.plan.toReach', { level, count: plan.needed })
              : [
                  open.length > 0 &&
                    t('progress.skills.plan.addsUpTo', { gain: percent(plan.gain) }),
                  t('progress.skills.plan.laterUnits', { level }),
                ]
                  .filter(Boolean)
                  .join(' ')}
        </p>
      )}
      {shown.length > 0 && (
        <ul className="skill-plan__lessons">
          {shown.map((lesson, index) => {
            const found = findLesson(lesson.id);
            const playable = lesson.step === SkillStep.Play || lesson.step === SkillStep.Redo;
            return (
              <li
                key={lesson.id}
                className={`skill-plan__lesson skill-plan__lesson--${lesson.step}${
                  index < plan.needed ? ' is-next' : ''
                }`}
              >
                <span className="skill-plan__step">{stepName[lesson.step]}</span>
                <span className="skill-plan__title">
                  {found ? courseText(`lessons.${lesson.id}`, found.lesson.titleVars) : lesson.id}{' '}
                  <span className="skill-plan__unit muted">
                    · {t('progress.skills.plan.unit', { number: lesson.unit })}
                  </span>
                </span>
                <span className="skill-plan__score">
                  {lesson.accuracy !== null && (
                    <>
                      <Stars stars={starsFor(lesson.accuracy)} size={StarsSize.Small} />
                      {percent(lesson.accuracy)}
                    </>
                  )}
                </span>
                <span className="skill-plan__gain">
                  {playable && t('progress.skills.plan.gain', { gain: percent(lesson.gain) })}
                </span>
                {playable ? (
                  <Link
                    className={`button skill-plan__play${index === 0 ? ' button--primary' : ''}`}
                    to={`/lesson/${lesson.id}`}
                  >
                    {lesson.step === SkillStep.Play
                      ? t('progress.skills.plan.play')
                      : t('progress.skills.plan.redo')}
                  </Link>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {locked > 0 && (
        <p className="skill-plan__locked muted">
          {t('progress.skills.plan.locked', {
            count: locked,
            units: t('progress.skills.plan.units', {
              count: lockedUnits.length,
              list: new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(
                lockedUnits.map(String),
              ),
            }),
          })}
        </p>
      )}
    </div>
  );
}
