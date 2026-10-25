/**
 * Ear training for the voice (PLAN.md milestone 6.4): single notes, intervals and short melodies
 * in the singer's range, sung back, or played back on the keyboard if chosen. Levels open with
 * the voice course's units; results are the voice's own.
 */
import { useCallback, useEffect, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { preloadAudio } from '../../../audio/audio';
import { VOICE_UNITS } from '../../../content/courses';
import { EarLevel, earRange } from '../../../content/earTraining';
import { isUnitFinished, lessonStates } from '../../../content/unlock';
import {
  openVoiceEarLevels,
  VOICE_EAR_LEVELS,
  VOICE_EAR_UNITS,
  voiceEarQuestions,
} from '../../../content/voiceEar';
import type { VocalRange } from '../../../engine/vocalRange';
import { useContentText } from '../../../i18n/useContentText';
import { isValueOf } from '../../../lib/values';
import { chooseVoiceEarLevel, setEarSingBack, useEarTraining } from '../../../storage/earTraining';
import { recordResult, resultKey, ResultKind, useProgress } from '../../../storage/progress';
import { useSettings } from '../../../storage/settings';
import { useMicWhileShown } from '../../hooks';
import { useTopBarDetail } from '../../topBar';
import { EarExercise } from './EarExercise';
import { SingBackExercise } from './SingBackExercise';
import { useEarLevelName } from './useEarLevelName';

export function VoiceEarTraining() {
  const { t } = useTranslation('screens');
  const courseText = useContentText('courses');
  const unitTitle = (unitId: string) => courseText(`units.${unitId}.title`);
  const range = useSettings((s) => s.vocalRange);
  const results = useProgress((s) => s.results);
  const states = useMemo(
    () =>
      lessonStates(VOICE_UNITS, (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0),
    [results],
  );
  const open = useMemo(() => openVoiceEarLevels(VOICE_UNITS, states), [states]);
  const finished = VOICE_UNITS.filter((unit) => isUnitFinished(unit, states))
    .map((unit) => unit.id)
    .join(' ');

  if (!range || open.length === 0) {
    return (
      <section className="screen">
        <h1>{t('earTraining.title')}</h1>
        <p className="muted">{t('earTraining.sing.intro')}</p>
        {range ? (
          <p className="notice">
            {t('earTraining.locked', { unit: unitTitle(VOICE_EAR_UNITS[EarLevel.Notes]!) })}
          </p>
        ) : (
          <p className="notice">
            {t('earTraining.sing.noRange')} <Link to="/settings#voice">{t('tuner.findRange')}</Link>
          </p>
        )}
        <Link className="button button--primary" to="/learn">
          {t('earTraining.toLessons')}
        </Link>
      </section>
    );
  }
  return <Exercises open={open} range={range} finished={finished} unitTitle={unitTitle} />;
}

interface ExercisesProps {
  open: readonly EarLevel[];
  range: VocalRange;
  /** The voice units finished, space-separated. */
  finished: string;
  unitTitle: (unitId: string) => string;
}

function Exercises({ open, range, finished, unitTitle }: ExercisesProps) {
  const { t } = useTranslation('screens');
  const levelName = useEarLevelName();
  const levelId = useId();
  const answerId = useId();
  const [params, setParams] = useSearchParams();
  const remembered = useEarTraining((s) => s.voiceLevel);
  const singBack = useEarTraining((s) => s.singBack);
  const asked = params.get('level');
  const level: EarLevel =
    isValueOf(EarLevel, asked) && open.includes(asked)
      ? asked
      : remembered && open.includes(remembered)
        ? remembered
        : open.at(-1)!;

  useTopBarDetail(levelName(level));
  useMicWhileShown();
  useEffect(preloadAudio, []);
  useEffect(() => chooseVoiceEarLevel(level), [level]);

  const makeQuestions = useCallback(
    () => voiceEarQuestions(level, range, new Set(finished.split(' '))),
    [level, range, finished],
  );
  const onFinish = (result: { stars: number; accuracy: number }, durationMs: number) =>
    void recordResult(ResultKind.VoiceEar, level, {
      stars: result.stars,
      accuracy: result.accuracy,
      durationMs,
    });
  const key = `${level} ${range.low} ${range.high} ${range.comfortable} ${finished}`;

  return (
    <section className="screen ear-training">
      <header className="practice__header">
        <div>
          <h1>{t('earTraining.title')}</h1>
          <p className="muted">{t(singBack ? 'earTraining.sing.intro' : 'earTraining.intro')}</p>
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
            {VOICE_EAR_LEVELS.map((option) => (
              <option key={option} value={option} disabled={!open.includes(option)}>
                {open.includes(option)
                  ? levelName(option)
                  : t('earTraining.lockedLevel', {
                      level: levelName(option),
                      unit: unitTitle(VOICE_EAR_UNITS[option]!),
                    })}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field" htmlFor={answerId}>
          {t('earTraining.sing.answerBy')}
          <select
            id={answerId}
            value={singBack ? 'sing' : 'keyboard'}
            onChange={(e) => setEarSingBack(e.target.value === 'sing')}
          >
            <option value="sing">{t('earTraining.sing.bySinging')}</option>
            <option value="keyboard">{t('earTraining.sing.byKeyboard')}</option>
          </select>
        </label>
      </div>
      {singBack ? (
        <SingBackExercise
          key={key}
          level={level}
          makeQuestions={makeQuestions}
          onFinish={onFinish}
        />
      ) : (
        <EarExercise
          key={key}
          level={level}
          range={earRange(new Set())}
          reference={false}
          makeQuestions={makeQuestions}
          onFinish={onFinish}
        />
      )}
    </section>
  );
}
