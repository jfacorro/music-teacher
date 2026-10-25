/**
 * Sight-singing (PLAN.md milestone 6.5): fresh melodies at a level the singer has reached, read
 * from the staff and sung, moved into the saved range. As for sight-reading, the drill is in the
 * address (`?level=leaps&seed=123`), and "New drill" makes another. The app doesn't play the
 * melody first: Play do gives the key note, and Hear it again (waiting) the note being sung.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { preloadAudio } from '../../../audio/audio';
import { VOICE_UNITS } from '../../../content/courses';
import { ScoreView, SheetNotation, SING_NOTATIONS } from '../../../content/lessons';
import {
  freshSingDrillSeed,
  makeSingDrill,
  openSingDrillLevels,
  SING_DRILL_LEVELS,
  SING_DRILL_UNITS,
  SingDrillLevel,
} from '../../../content/sightSinging';
import { lessonStates } from '../../../content/unlock';
import { SING_CENTS, SingMode } from '../../../engine/singing';
import { fitToRange } from '../../../engine/transpose';
import type { VocalRange } from '../../../engine/vocalRange';
import { useContentText } from '../../../i18n/useContentText';
import { isValueOf } from '../../../lib/values';
import { recordResult, resultKey, ResultKind, useProgress } from '../../../storage/progress';
import { useSettings } from '../../../storage/settings';
import { rememberSingDrill, useSightReading } from '../../../storage/sightReading';
import { VolumeButton } from '../../components/VolumeControls';
import { useMicWhileShown } from '../../hooks';
import { ICONS } from '../../icons';
import { useTopBarDetail } from '../../topBar';
import { NotationSelect } from '../practice/ViewToggle';
import { KeyNoteButton, MovableDoNote } from '../singing/KeyNoteButton';
import { SingRun } from '../singing/SingRun';

type DrillMode = typeof SingMode.Wait | typeof SingMode.Along;
const MODES: readonly DrillMode[] = [SingMode.Wait, SingMode.Along];

/** A seed from the address: a whole number from 0 to 2³² − 1 (null: none, or not one). */
function parseSeed(input: string | null): number | null {
  if (input === null || !/^\d{1,10}$/.test(input)) return null;
  const seed = Number(input);
  return seed < 2 ** 32 ? seed : null;
}

const freshSeed = (level: SingDrillLevel) =>
  freshSingDrillSeed(level, useSightReading.getState().voiceRecent[level] ?? []);

export function SightSingingScreen() {
  const { t } = useTranslation('screens');
  const courseText = useContentText('courses');
  const range = useSettings((s) => s.vocalRange);
  const results = useProgress((s) => s.results);
  const open = useMemo(
    () =>
      openSingDrillLevels(
        VOICE_UNITS,
        lessonStates(
          VOICE_UNITS,
          (id) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0,
        ),
      ),
    [results],
  );
  const unitTitle = (unitId: string) => courseText(`units.${unitId}.title`);

  if (!range || open.length === 0) {
    return (
      <section className="screen">
        <h1>{t('sightSinging.title')}</h1>
        <p className="muted">{t('sightSinging.intro')}</p>
        {range ? (
          <p className="notice">
            {t('sightSinging.locked', { unit: unitTitle(SING_DRILL_UNITS[SING_DRILL_LEVELS[0]!]) })}
          </p>
        ) : (
          <p className="notice">
            {t('sightSinging.noRange')} <Link to="/settings#voice">{t('tuner.findRange')}</Link>
          </p>
        )}
        <Link className="button button--primary" to="/learn">
          {t('sightReading.toLessons')}
        </Link>
      </section>
    );
  }
  return <Drills open={open} range={range} unitTitle={unitTitle} />;
}

interface DrillsProps {
  open: readonly SingDrillLevel[];
  range: VocalRange;
  unitTitle: (unitId: string) => string;
}

function Drills({ open, range, unitTitle }: DrillsProps) {
  const { t } = useTranslation('screens');
  const levelId = useId();
  const [params, setParams] = useSearchParams();
  const remembered = useSightReading((s) => s.voiceLevel);
  const asked = params.get('level');
  const level: SingDrillLevel =
    isValueOf(SingDrillLevel, asked) && open.includes(asked)
      ? asked
      : remembered && open.includes(remembered)
        ? remembered
        : open.at(-1)!;
  const levelName = (option: SingDrillLevel) => t(`sightSinging.levels.${option}`);
  useTopBarDetail(levelName(level));
  useMicWhileShown();
  useEffect(preloadAudio, []);
  const seed = parseSeed(params.get('seed'));
  const inAddress = seed !== null && asked === level;

  const [mode, setMode] = useState<DrillMode>(SingMode.Wait);
  const [notation, setNotation] = useState<SheetNotation>(SheetNotation.Syllables);
  // Reading at sight: the app doesn't play the melody unless asked to.
  const [guide, setGuide] = useState(false);
  const [metronome, setMetronome] = useState(true);

  // The drill goes in the address: a new one when none (or another level) is asked for.
  useEffect(() => {
    if (inAddress) return;
    setParams({ level, seed: String(seed ?? freshSeed(level)) }, { replace: true });
  }, [inAddress, level, seed, setParams]);
  useEffect(() => {
    if (inAddress) rememberSingDrill(level, seed);
  }, [inAddress, level, seed]);

  const fit = useMemo(
    () => (inAddress ? fitToRange(makeSingDrill(level, seed).score, range) : null),
    [inAddress, level, seed, range],
  );
  if (!fit) return null;

  const newDrill = (next: SingDrillLevel = level) =>
    setParams({ level: next, seed: String(freshSeed(next)) });

  return (
    <section className="screen practice sight-reading">
      <header className="practice__header">
        <div>
          <h1>{t('sightSinging.title')}</h1>
          <p className="muted">{t('sightSinging.intro')}</p>
        </div>
        <button
          type="button"
          className="button button--primary"
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
        <label className="inline-field" htmlFor={levelId}>
          {t('sightReading.level')}
          <select
            id={levelId}
            value={level}
            onChange={(e) => newDrill(e.target.value as SingDrillLevel)}
          >
            {SING_DRILL_LEVELS.map((option) => (
              <option key={option} value={option} disabled={!open.includes(option)}>
                {open.includes(option)
                  ? levelName(option)
                  : t('sightReading.lockedLevel', {
                      level: levelName(option),
                      unit: unitTitle(SING_DRILL_UNITS[option]),
                    })}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented" role="radiogroup" aria-label={t('practice.mode.label')}>
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={mode === value ? 'segmented__option is-selected' : 'segmented__option'}
              onClick={() => setMode(value)}
            >
              {t(`sightSinging.modes.${value}`)}
            </button>
          ))}
        </div>
        <NotationSelect notation={notation} onChange={setNotation} options={SING_NOTATIONS} />
        <label className="checkbox" title={t(`sing.guideTip.${mode}`)}>
          <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
          {t('sing.guide')}
        </label>
        {mode === SingMode.Along && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={metronome}
              onChange={(e) => setMetronome(e.target.checked)}
            />
            {t('practice.metronome')}
          </label>
        )}
        <KeyNoteButton score={fit.score} />
        <VolumeButton />
      </div>
      {notation === SheetNotation.Syllables && <MovableDoNote score={fit.score} />}
      {!fit.fits && <p className="notice">{t('sing.beyondRange')}</p>}

      <SingRun
        key={`${level}-${seed}-${mode}-${fit.semitones}`}
        score={fit.score}
        mode={mode}
        cents={SING_CENTS}
        octave={false}
        guide={guide}
        metronome={metronome}
        view={ScoreView.Sheet}
        notation={notation}
        onFinish={(summary, durationMs) =>
          void recordResult(ResultKind.VoiceDrill, level, {
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
