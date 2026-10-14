import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { preloadAudio } from '../../../audio/audio';
import type { SongId } from '../../../content/songs';
import type { Score } from '../../../engine/score';
import type { HandFilter, LoopRange, PracticeMode } from '../../../engine/session';
import { recordResult } from '../../../storage/progress';
import type { ScoreView } from '../../../content/lessons';
import { useSettings } from '../../../storage/settings';
import { Markings } from '../../components/Markings';
import { PracticeRun } from './PracticeRun';
import { PracticeTools, SPEED_MAX } from './PracticeTools';
import { NotationSelect, ViewToggle } from './ViewToggle';

const MODES: readonly PracticeMode[] = ['wait', 'tempo'];
const HANDS: readonly HandFilter[] = ['both', 'R', 'L'];

/** Song header and practice options; each combination of options is a fresh run. */
export function PracticeView({ songId, score }: { songId: SongId; score: Score }) {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const [mode, setMode] = useState<PracticeMode>('wait');
  const [hands, setHands] = useState<HandFilter>('both');
  const [metronome, setMetronome] = useState(false);
  const [view, setView] = useState<ScoreView>('falling');
  const [notation, setNotation] = useState(() => useSettings.getState().sheetNotation);
  const [speed, setSpeed] = useState(SPEED_MAX);
  const [loop, setLoop] = useState<LoopRange>({
    first: 0,
    last: Math.min(1, score.measures.length - 1),
  });
  const [looping, setLooping] = useState(false);
  const [otherHand, setOtherHand] = useState(false);
  const handsId = useId();

  /** null: stop repeating (keeping the bars for next time). */
  const chooseLoop = (range: LoopRange | null, on = true) => {
    if (range) setLoop(range);
    setLooping(range !== null && on);
  };

  useEffect(preloadAudio, []);

  const chooseMode = (next: PracticeMode) => {
    setMode(next);
    setMetronome(next === 'tempo'); // a steady click only makes sense when playing along
  };

  return (
    <section className="screen practice">
      <header className="practice__header">
        <div>
          <h1>{ts(`${songId}.title`)}</h1>
          <p className="muted">
            {t('practice.songInfo', { composer: ts(`${songId}.composer`), bpm: score.tempo })}
            <Markings markings={score.markings ?? []} />
          </p>
        </div>
      </header>

      <div className="practice__options">
        <ViewToggle view={view} onChange={setView} />
        {view === 'sheet' && <NotationSelect notation={notation} onChange={setNotation} />}
        <div className="segmented" role="radiogroup" aria-label={t('practice.mode.label')}>
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={mode === value ? 'segmented__option is-selected' : 'segmented__option'}
              onClick={() => chooseMode(value)}
            >
              {t(`practice.mode.${value}`)}
            </button>
          ))}
        </div>
        <label className="inline-field" htmlFor={handsId}>
          {t('practice.hands.label')}
          <select
            id={handsId}
            value={hands}
            onChange={(e) => setHands(e.target.value as HandFilter)}
          >
            {HANDS.map((value) => (
              <option key={value} value={value}>
                {t(`practice.hands.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={metronome}
            onChange={(e) => setMetronome(e.target.checked)}
          />
          {t('practice.metronome')}
        </label>
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
        otherHand={hands !== 'both' && otherHand}
        onLoopChange={chooseLoop}
        onFinish={(summary, durationMs) =>
          void recordResult('song', songId, {
            stars: summary.stars,
            accuracy: summary.accuracy,
            durationMs,
          })
        }
      />
    </section>
  );
}
