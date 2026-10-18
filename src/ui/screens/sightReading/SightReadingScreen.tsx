import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { preloadAudio } from '../../../audio/audio';
import { UNITS } from '../../../content/courses';
import { ScoreView, SheetNotation } from '../../../content/lessons';
import {
  DRILL_LEVELS,
  DRILL_UNITS,
  DrillLevel,
  freshDrillSeed,
  makeDrill,
  openDrillLevels,
} from '../../../content/sightReading';
import { lessonStates } from '../../../content/unlock';
import { PracticeMode } from '../../../engine/session';
import { useContentText } from '../../../i18n/useContentText';
import { isValueOf } from '../../../lib/values';
import { recordResult, resultKey, ResultKind, useProgress } from '../../../storage/progress';
import { dropRecordings } from '../../../storage/recordings';
import { rememberDrill, useSightReading } from '../../../storage/sightReading';
import { VolumeButton } from '../../components/VolumeControls';
import { ICONS } from '../../icons';
import { useTopBarDetail } from '../../topBar';
import { PracticeRun } from '../practice/PracticeRun';
import { useDrillLevelName } from './useDrillLevelName';

const MODES: readonly PracticeMode[] = [PracticeMode.Wait, PracticeMode.Tempo];
const RECORDING_PREFIX = 'drill:';

/** A seed from the address: a whole number from 0 to 2³² − 1 (null: none, or not one). */
function parseSeed(input: string | null): number | null {
  if (input === null || !/^\d{1,10}$/.test(input)) return null;
  const seed = Number(input);
  return seed < 2 ** 32 ? seed : null;
}

const freshSeed = (level: DrillLevel) =>
  freshDrillSeed(level, useSightReading.getState().recent[level] ?? []);

/**
 * Sight-reading (PLAN.md milestone 4.3): fresh music at a level the learner has reached, read
 * from the sheet. The drill is in the address (`?level=bass&seed=123`), so it can be tried
 * again or reloaded; "New drill" makes another.
 */
export function SightReadingScreen() {
  const results = useProgress((s) => s.results);
  const open = useMemo(
    () =>
      openDrillLevels(
        UNITS,
        lessonStates(UNITS, (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0),
      ),
    [results],
  );
  return open.length === 0 ? <Locked /> : <Drills open={open} />;
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
  const first = DRILL_LEVELS[0]!;
  return (
    <section className="screen">
      <h1>{t('sightReading.title')}</h1>
      <p className="muted">{t('sightReading.intro')}</p>
      <p className="notice">{t('sightReading.locked', { unit: unitTitle(DRILL_UNITS[first]) })}</p>
      <Link className="button button--primary" to="/learn">
        {t('sightReading.toLessons')}
      </Link>
    </section>
  );
}

function Drills({ open }: { open: readonly DrillLevel[] }) {
  const { t } = useTranslation('screens');
  const levelName = useDrillLevelName();
  const unitTitle = useUnitTitle();
  const levelId = useId();
  const [params, setParams] = useSearchParams();
  const remembered = useSightReading((s) => s.level);
  const asked = params.get('level');
  const level: DrillLevel =
    isValueOf(DrillLevel, asked) && open.includes(asked)
      ? asked
      : remembered && open.includes(remembered)
        ? remembered
        : open.at(-1)!;
  useTopBarDetail(levelName(level));
  const seed = parseSeed(params.get('seed'));
  const inAddress = seed !== null && asked === level;

  const [mode, setMode] = useState<PracticeMode>(PracticeMode.Wait);
  const [metronome, setMetronome] = useState(false);
  /** Playing the last run back: the drill settings wait. */
  const [listening, setListening] = useState(false);

  useEffect(preloadAudio, []);

  // The drill goes in the address: a new one when none (or another level) is asked for.
  useEffect(() => {
    if (inAddress) return;
    setParams({ level, seed: String(seed ?? freshSeed(level)) }, { replace: true });
  }, [inAddress, level, seed, setParams]);

  const recordingKey = `${RECORDING_PREFIX}${level}:${seed}`;
  // Remembered so new drills differ from it; the recording of the drill before is dropped.
  useEffect(() => {
    if (!inAddress) return;
    rememberDrill(level, seed);
    void dropRecordings(RECORDING_PREFIX, recordingKey);
  }, [inAddress, level, seed, recordingKey]);

  const drill = useMemo(
    () => (inAddress ? makeDrill(level, seed) : null),
    [inAddress, level, seed],
  );
  if (!drill) return null;

  const newDrill = (next: DrillLevel = level) =>
    setParams({ level: next, seed: String(freshSeed(next)) });
  const chooseMode = (next: PracticeMode) => {
    setMode(next);
    setMetronome(next === PracticeMode.Tempo); // a steady click only makes sense when playing along
  };
  const setAside = (className: string) => (listening ? `${className} is-set-aside` : className);

  return (
    <section className="screen practice sight-reading">
      <header className="practice__header">
        <div>
          <h1>{t('sightReading.title')}</h1>
          <p className="muted">{t('sightReading.intro')}</p>
        </div>
        <button
          type="button"
          className={setAside('button button--primary')}
          inert={listening}
          title={t('sightReading.newDrillTip')}
          onClick={() => newDrill()}
        >
          <span className="button__icon" aria-hidden="true">
            {ICONS.newDrill}
          </span>
          {t('sightReading.newDrill')}
        </button>
      </header>

      <div className="practice__options">
        <label className={setAside('inline-field')} htmlFor={levelId} inert={listening}>
          {t('sightReading.level')}
          <select
            id={levelId}
            value={level}
            onChange={(e) => newDrill(e.target.value as DrillLevel)}
          >
            {DRILL_LEVELS.map((option) => (
              <option key={option} value={option} disabled={!open.includes(option)}>
                {open.includes(option)
                  ? levelName(option)
                  : t('sightReading.lockedLevel', {
                      level: levelName(option),
                      unit: unitTitle(DRILL_UNITS[option]),
                    })}
              </option>
            ))}
          </select>
        </label>
        <div
          className={setAside('segmented')}
          role="radiogroup"
          aria-label={t('practice.mode.label')}
          inert={listening}
        >
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              aria-label={t(`practice.mode.${value}`)}
              className={
                mode === value
                  ? 'segmented__option segmented__option--icon is-selected'
                  : 'segmented__option segmented__option--icon'
              }
              title={t(`practice.tips.${value}`)}
              onClick={() => chooseMode(value)}
            >
              <span aria-hidden="true">{ICONS[value]}</span>
            </button>
          ))}
        </div>
        <div className="practice__sound">
          <label className={setAside('checkbox')} inert={listening}>
            <input
              type="checkbox"
              checked={metronome}
              onChange={(e) => setMetronome(e.target.checked)}
            />
            {t('practice.metronome')}
          </label>
          <VolumeButton />
        </div>
      </div>

      <PracticeRun
        key={`${level}-${seed}-${mode}`}
        score={drill.score}
        mode={mode}
        hands={drill.hands}
        metronome={metronome}
        view={ScoreView.Sheet}
        notation={SheetNotation.Plain}
        sightReading
        hint={mode === PracticeMode.Wait ? t('sightReading.hintWait') : t('sightReading.hintTempo')}
        recordingKey={recordingKey}
        onListeningChange={setListening}
        onFinish={(summary, durationMs) =>
          void recordResult(ResultKind.Drill, level, {
            stars: summary.stars,
            accuracy: summary.accuracy,
            durationMs,
          })
        }
        resultsActions={() => (
          <button
            type="button"
            className="button button--primary"
            title={t('sightReading.newDrillTip')}
            onClick={() => newDrill()}
          >
            {t('sightReading.nextDrill')}
          </button>
        )}
      />
    </section>
  );
}
