import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { preloadAudio } from '../../../audio/audio';
import type { SongId } from '../../../content/songs';
import type { Score } from '../../../engine/score';
import type { HandFilter, PracticeMode } from '../../../engine/session';
import { recordResult } from '../../../storage/progress';
import { PracticeRun } from './PracticeRun';

const MODES: readonly PracticeMode[] = ['wait', 'tempo'];
const HANDS: readonly HandFilter[] = ['both', 'R', 'L'];

/** Song header and practice options; each combination of options is a fresh run. */
export function PracticeView({ songId, score }: { songId: SongId; score: Score }) {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const [mode, setMode] = useState<PracticeMode>('wait');
  const [hands, setHands] = useState<HandFilter>('both');
  const [metronome, setMetronome] = useState(false);
  const handsId = useId();

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
          </p>
        </div>
      </header>

      <div className="practice__options">
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

      <PracticeRun
        key={`${mode}-${hands}`}
        score={score}
        mode={mode}
        hands={hands}
        metronome={metronome}
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
