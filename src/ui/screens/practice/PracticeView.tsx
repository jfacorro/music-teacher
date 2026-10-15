import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { preloadAudio } from '../../../audio/audio';
import type { SongId } from '../../../content/songs';
import type { Score } from '../../../engine/score';
import { HandFilter, type LoopRange, PracticeMode } from '../../../engine/session';
import { recordResult, ResultKind } from '../../../storage/progress';
import { ScoreView } from '../../../content/lessons';
import { useSettings } from '../../../storage/settings';
import { Markings } from '../../components/Markings';
import { PracticeRun } from './PracticeRun';
import { PracticeTools, SPEED_MAX } from './PracticeTools';
import { ICONS } from '../../icons';
import { NotationSelect, ViewToggle } from './ViewToggle';

const MODES: readonly PracticeMode[] = [PracticeMode.Wait, PracticeMode.Tempo];
/** In the order of the hands on the keyboard: left, both, right. */
const HANDS: readonly HandFilter[] = [HandFilter.Left, HandFilter.Both, HandFilter.Right];

/** Song header and practice options; each combination of options is a fresh run. */
export function PracticeView({ songId, score }: { songId: SongId; score: Score }) {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const [mode, setMode] = useState<PracticeMode>(PracticeMode.Wait);
  const [hands, setHands] = useState<HandFilter>(HandFilter.Both);
  const [metronome, setMetronome] = useState(false);
  const [view, setView] = useState<ScoreView>(ScoreView.Falling);
  const [notation, setNotation] = useState(() => useSettings.getState().sheetNotation);
  const [speed, setSpeed] = useState(SPEED_MAX);
  const [loop, setLoop] = useState<LoopRange>({
    first: 0,
    last: Math.min(1, score.measures.length - 1),
  });
  const [looping, setLooping] = useState(false);
  const [otherHand, setOtherHand] = useState(false);

  /** null: stop repeating (keeping the bars for next time). */
  const chooseLoop = (range: LoopRange | null, on = true) => {
    if (range) setLoop(range);
    setLooping(range !== null && on);
  };

  useEffect(preloadAudio, []);

  const chooseMode = (next: PracticeMode) => {
    setMode(next);
    setMetronome(next === PracticeMode.Tempo); // a steady click only makes sense when playing along
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
        {view === ScoreView.Sheet && <NotationSelect notation={notation} onChange={setNotation} />}
        <div className="segmented" role="radiogroup" aria-label={t('practice.mode.label')}>
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
        <div className="segmented" role="radiogroup" aria-label={t('practice.hands.label')}>
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
        otherHand={hands !== HandFilter.Both && otherHand}
        onLoopChange={chooseLoop}
        onFinish={(summary, durationMs) =>
          void recordResult(ResultKind.Song, songId, {
            stars: summary.stars,
            accuracy: summary.accuracy,
            durationMs,
          })
        }
      />
    </section>
  );
}
