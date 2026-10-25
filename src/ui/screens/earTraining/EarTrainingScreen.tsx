import { useEffect, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { preloadAudio } from '../../../audio/audio';
import { Course, UNITS } from '../../../content/courses';
import {
  EAR_LEVELS,
  EAR_UNITS,
  EarLevel,
  earRange,
  type EarRange,
  openEarLevels,
} from '../../../content/earTraining';
import { isUnitFinished, lessonStates } from '../../../content/unlock';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { MIDDLE_C, pitchFromMidi } from '../../../theory/pitch';
import { useContentText } from '../../../i18n/useContentText';
import { isValueOf } from '../../../lib/values';
import {
  chooseEarLevel,
  setEarAllNotes,
  setEarReference,
  useEarTraining,
} from '../../../storage/earTraining';
import { recordResult, resultKey, ResultKind, useProgress } from '../../../storage/progress';
import { useSettings } from '../../../storage/settings';
import { useTopBarDetail } from '../../topBar';
import { EarExercise } from './EarExercise';
import { useEarLevelName } from './useEarLevelName';
import { VoiceEarTraining } from './VoiceEarTraining';

/**
 * Ear training (PLAN.md milestone 4.4): the app plays something, the learner plays it back. The
 * level is in the address (`?level=intervals`), so the Today card can link to one. The voice has
 * its own (milestone 6.4), sung back.
 */
export function EarTrainingScreen() {
  const course = useSettings((s) => s.course);
  return course === Course.Voice ? <VoiceEarTraining /> : <PianoEarTraining />;
}

function PianoEarTraining() {
  const results = useProgress((s) => s.results);
  const states = useMemo(
    () => lessonStates(UNITS, (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0),
    [results],
  );
  const open = useMemo(() => openEarLevels(UNITS, states), [states]);
  const finished = UNITS.filter((unit) => isUnitFinished(unit, states)).map((unit) => unit.id);
  const allNotes = useEarTraining((s) => s.allNotes);
  // Only a new list of units finished makes new questions.
  const finishedKey = finished.join(' ');
  const range = useMemo(
    () => earRange(new Set(finishedKey.split(' ')), allNotes),
    [finishedKey, allNotes],
  );
  return open.length === 0 ? <Locked /> : <Exercises open={open} range={range} />;
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

function Exercises({ open, range }: { open: readonly EarLevel[]; range: EarRange }) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const reference = useEarTraining((s) => s.reference);
  const allNotes = useEarTraining((s) => s.allNotes);
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

  useTopBarDetail(levelName(level));

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
        {level === EarLevel.Notes && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={reference}
              onChange={(e) => setEarReference(e.target.checked)}
            />
            {t('earTraining.reference', {
              c: names.name(pitchFromMidi(MIDDLE_C), { octave: false }),
            })}
          </label>
        )}
        {(level === EarLevel.Notes || level === EarLevel.Intervals) && (
          <label
            className="checkbox"
            title={t('earTraining.allNotesTip', {
              c: names.name(pitchFromMidi(MIDDLE_C), { octave: false }),
            })}
          >
            <input
              type="checkbox"
              checked={allNotes}
              onChange={(e) => setEarAllNotes(e.target.checked)}
            />
            {t('earTraining.allNotes')}
          </label>
        )}
      </div>
      <EarExercise
        key={`${level} ${range.keys.join(' ')} ${range.intervals.join(' ')}`}
        level={level}
        range={range}
        reference={reference}
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
