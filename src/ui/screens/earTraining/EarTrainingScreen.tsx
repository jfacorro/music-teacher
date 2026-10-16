import { useEffect, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { preloadAudio } from '../../../audio/audio';
import { UNITS } from '../../../content/courses';
import { EAR_LEVELS, EAR_UNITS, EarLevel, openEarLevels } from '../../../content/earTraining';
import { lessonStates } from '../../../content/unlock';
import { useContentText } from '../../../i18n/useContentText';
import { isValueOf } from '../../../lib/values';
import { chooseEarLevel, useEarTraining } from '../../../storage/earTraining';
import { recordResult, resultKey, ResultKind, useProgress } from '../../../storage/progress';
import { EarExercise } from './EarExercise';
import { useEarLevelName } from './useEarLevelName';

/**
 * Ear training (PLAN.md milestone 4.4): the app plays something, the learner plays it back. The
 * level is in the address (`?level=intervals`), so the Today card can link to one.
 */
export function EarTrainingScreen() {
  const results = useProgress((s) => s.results);
  const open = useMemo(
    () =>
      openEarLevels(
        UNITS,
        lessonStates(UNITS, (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0),
      ),
    [results],
  );
  return open.length === 0 ? <Locked /> : <Exercises open={open} />;
}

function useUnitTitle() {
  const courseText = useContentText('courses');
  return (unitId: string) =>
    courseText(`units.${unitId}.title`, UNITS.find((unit) => unit.id === unitId)?.textVars);
}

/** Before the first level opens: what it takes. */
function Locked() {
  const { t } = useTranslation('screens');
  const unitTitle = useUnitTitle();
  return (
    <section className="screen">
      <h1>{t('earTraining.title')}</h1>
      <p className="muted">{t('earTraining.intro')}</p>
      <p className="notice">
        {t('earTraining.locked', { unit: unitTitle(EAR_UNITS[EAR_LEVELS[0]!]) })}
      </p>
      <Link className="button button--primary" to="/learn">
        {t('earTraining.toLessons')}
      </Link>
    </section>
  );
}

function Exercises({ open }: { open: readonly EarLevel[] }) {
  const { t } = useTranslation('screens');
  const levelName = useEarLevelName();
  const unitTitle = useUnitTitle();
  const levelId = useId();
  const [params, setParams] = useSearchParams();
  const remembered = useEarTraining((s) => s.level);
  const asked = params.get('level');
  const level: EarLevel =
    isValueOf(EarLevel, asked) && open.includes(asked)
      ? asked
      : remembered && open.includes(remembered)
        ? remembered
        : open.at(-1)!;

  useEffect(preloadAudio, []);
  useEffect(() => chooseEarLevel(level), [level]);

  return (
    <section className="screen ear-training">
      <header className="practice__header">
        <div>
          <h1>{t('earTraining.title')}</h1>
          <p className="muted">{t('earTraining.intro')}</p>
        </div>
      </header>
      <div className="practice__options">
        <label className="inline-field" htmlFor={levelId}>
          {t('earTraining.level')}
          <select
            id={levelId}
            value={level}
            onChange={(e) => setParams({ level: e.target.value }, { replace: true })}
          >
            {EAR_LEVELS.map((option) => (
              <option key={option} value={option} disabled={!open.includes(option)}>
                {open.includes(option)
                  ? levelName(option)
                  : t('earTraining.lockedLevel', {
                      level: levelName(option),
                      unit: unitTitle(EAR_UNITS[option]),
                    })}
              </option>
            ))}
          </select>
        </label>
      </div>
      <EarExercise
        key={level}
        level={level}
        onFinish={(result, durationMs) =>
          void recordResult(ResultKind.Ear, level, {
            stars: result.stars,
            accuracy: result.accuracy,
            durationMs,
          })
        }
      />
    </section>
  );
}
