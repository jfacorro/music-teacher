import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { metronomeAtStart } from '../../metronomeChoice';
import { viewAtStart } from '../../viewChoice';
import { preloadAudio } from '../../../audio/audio';
import type { Score } from '../../../engine/score';
import { HandFilter, type LoopRange, PracticeMode } from '../../../engine/session';
import { weakSpot } from '../../../engine/weakSpots';
import { recordResult, resultKey, type ResultKind, useProgress } from '../../../storage/progress';
import { RunHistory } from '../../components/RunHistory';
import {
  isDone,
  markPracticed,
  todaysWeakSpot,
  useTodayPlan,
  WEAK_SPOT_PASSES,
} from '../../../storage/todayPlan';
import { parseBars } from '../../barSelection';
import { ScoreView } from '../../../content/lessons';
import { useSettings } from '../../../storage/settings';
import { Markings } from '../../components/Markings';
import { PracticeRun } from './PracticeRun';
import { PracticeTools, SPEED_MAX } from './PracticeTools';
import { ICONS } from '../../icons';
import { VolumeButton } from '../../components/VolumeControls';
import { NotationSelect, ViewToggle } from './ViewToggle';

const MODES: readonly PracticeMode[] = [
  PracticeMode.Wait,
  PracticeMode.Tempo,
  PracticeMode.Autoplay,
];
/** In the order of the hands on the keyboard: left, both, right. */
const HANDS: readonly HandFilter[] = [HandFilter.Left, HandFilter.Both, HandFilter.Right];

interface PracticeViewProps {
  title: string;
  composer: string | null;
  score: Score;
  /** Where finished runs are saved. */
  result: { kind: ResultKind; id: string };
  /** Shown next to the title, e.g. a link to the song's settings. */
  actions?: ReactNode;
}

/**
 * Song header and practice options; each combination of options is a fresh run. The address
 * can ask for bars to repeat from the start (`?bars=5-6`, counted from 1).
 */
export function PracticeView({ title, composer, score, result, actions }: PracticeViewProps) {
  const { t } = useTranslation('screens');
  const [mode, setMode] = useState<PracticeMode>(PracticeMode.Wait);
  const [hands, setHands] = useState<HandFilter>(HandFilter.Both);
  // Waiting for each note at first: the metronome only if the setting asks for it.
  const [metronome, setMetronome] = useState(() =>
    metronomeAtStart(useSettings.getState().exerciseMetronome, false),
  );
  const [view, setView] = useState(() =>
    viewAtStart(useSettings.getState().exerciseView, ScoreView.Falling),
  );
  const [notation, setNotation] = useState(() => useSettings.getState().sheetNotation);
  const [speed, setSpeed] = useState(SPEED_MAX);
  const [params] = useSearchParams();
  const [asked] = useState(() => parseBars(params.get('bars'), score.measures.length));
  const [loop, setLoop] = useState<LoopRange>(
    () => asked ?? { first: 0, last: Math.min(1, score.measures.length - 1) },
  );
  const [looping, setLooping] = useState(asked !== null);
  const [otherHand, setOtherHand] = useState(false);
  /** Playing the last run back: the practice settings wait. */
  const [listening, setListening] = useState(false);

  // Today's weak spot in this song: repeating its bars ticks it off, and the hint says how far.
  const key = resultKey(result.kind, result.id);
  const weak = useTodayPlan((s) => todaysWeakSpot(s.plans, key));
  const weakDone = useProgress((s) => (weak ? isDone(weak, s.results) : false));
  // Every finished run of this song, oldest first.
  const log = useProgress((s) => s.log);
  const runs = useMemo(
    () => log.filter((entry) => entry.kind === result.kind && entry.refId === result.id),
    [log, result.kind, result.id],
  );
  /** Times through the weak spot's bars, across modes and hands. */
  const [weakPasses, setWeakPasses] = useState(0);
  const onWeakSpot =
    weak?.bars !== undefined &&
    looping &&
    loop.first <= weak.bars.first &&
    loop.last >= weak.bars.last;
  useEffect(() => {
    if (weakPasses >= WEAK_SPOT_PASSES) markPracticed(key);
  }, [weakPasses, key]);
  const weakGoal = !onWeakSpot
    ? null
    : weakDone
      ? t('practice.loop.weakSpotDone')
      : t('practice.loop.weakSpot', { count: WEAK_SPOT_PASSES, done: weakPasses });

  /** null: stop repeating (keeping the bars for next time). */
  const chooseLoop = (range: LoopRange | null, on = true) => {
    if (range) setLoop(range);
    setLooping(range !== null && on);
  };

  useEffect(preloadAudio, []);

  const chooseMode = (next: PracticeMode) => {
    setMode(next);
    // Usually a steady click only makes sense when playing along.
    setMetronome(
      metronomeAtStart(useSettings.getState().exerciseMetronome, next === PracticeMode.Tempo),
    );
  };

  return (
    <section className="screen practice">
      <header className="practice__header">
        <div>
          <h1>{title}</h1>
          <p className="muted">
            {composer
              ? t('practice.songInfo', { composer, bpm: score.tempo })
              : t('practice.tempoInfo', { bpm: score.tempo })}
            <Markings markings={score.markings ?? []} />
          </p>
        </div>
        {actions}
      </header>
      <RunHistory runs={runs} label={t('lesson.history.songLabel')} />

      <div className="practice__options">
        <ViewToggle view={view} onChange={setView} />
        {view === ScoreView.Sheet && <NotationSelect notation={notation} onChange={setNotation} />}
        <div
          className={listening ? 'segmented is-set-aside' : 'segmented'}
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
        <div
          className={listening ? 'segmented is-set-aside' : 'segmented'}
          role="radiogroup"
          aria-label={t('practice.hands.label')}
          inert={listening}
        >
          {HANDS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={hands === value}
              aria-label={t(`practice.hands.${value}`)}
              className={
                hands === value
                  ? 'segmented__option segmented__option--icon is-selected'
                  : 'segmented__option segmented__option--icon'
              }
              title={t(`practice.tips.hands.${value}`)}
              onClick={() => setHands(value)}
            >
              <span aria-hidden="true">{ICONS[value]}</span>
            </button>
          ))}
        </div>
        <div className="practice__sound">
          <label className={listening ? 'checkbox is-set-aside' : 'checkbox'} inert={listening}>
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

      <PracticeTools
        score={score}
        speed={speed}
        onSpeedChange={setSpeed}
        loop={loop}
        looping={looping}
        onLoopChange={chooseLoop}
        hands={hands}
        otherHand={otherHand}
        onOtherHandChange={setOtherHand}
        setAside={listening}
      />

      <PracticeRun
        key={`${mode}-${hands}`}
        score={score}
        mode={mode}
        hands={hands}
        metronome={metronome}
        view={view}
        notation={notation}
        speed={speed}
        loop={looping ? loop : null}
        otherHand={hands !== HandFilter.Both && otherHand}
        onLoopChange={chooseLoop}
        onFinish={(summary, durationMs) =>
          void recordResult(result.kind, result.id, {
            stars: summary.stars,
            accuracy: summary.accuracy,
            durationMs,
            weakBars: weakSpot(summary.measures),
          })
        }
        recordingKey={key}
        onListeningChange={setListening}
        barSteps
        loopGoal={weakGoal}
        onLoopPass={() => {
          if (onWeakSpot) setWeakPasses((passes) => passes + 1);
        }}
      />
    </section>
  );
}
