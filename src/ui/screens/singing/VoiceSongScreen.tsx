/**
 * A song sung with its words (PLAN.md milestone 6.6): the melody moved into the singer's range,
 * the words under the notes, and the piano playing the rest of the song along, moved with it.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { preloadAudio } from '../../../audio/audio';
import { ScoreView, SheetNotation } from '../../../content/lessons';
import { isSongId, loadSong, type SongId, VOICE_SONG_IDS } from '../../../content/songs';
import { moveAccompaniment, type SongParts, songParts } from '../../../engine/lyrics';
import { SING_CENTS, SingMode } from '../../../engine/singing';
import { fitToRange } from '../../../engine/transpose';
import type { VocalRange } from '../../../engine/vocalRange';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { recordResult, ResultKind } from '../../../storage/progress';
import { useSettings } from '../../../storage/settings';
import { VolumeButton } from '../../components/VolumeControls';
import { useMicWhileShown } from '../../hooks';
import { LoadStatus } from '../../loadStatus';
import { useTopBarDetail } from '../../topBar';
import { NotationSelect, ViewToggle } from '../practice/ViewToggle';
import { KeyNoteButton, MovableDoNote } from './KeyNoteButton';
import { LyricsSelect, SongWords } from './lyrics';
import { useLyricsLanguage } from './useLyricsLanguage';
import { singNotations, startNotation } from './singNotation';
import { SingRun } from './SingRun';

type SongMode = typeof SingMode.Along | typeof SingMode.Wait;
const MODES: readonly SongMode[] = [SingMode.Along, SingMode.Wait];

type LoadState =
  | { status: typeof LoadStatus.Loading }
  | { status: typeof LoadStatus.Ready; parts: SongParts }
  | { status: typeof LoadStatus.Error };

export function VoiceSongScreen() {
  const { songId } = useParams();
  const { t } = useTranslation('screens');
  if (!isSongId(songId) || !VOICE_SONG_IDS.includes(songId)) {
    return (
      <section className="screen">
        <p className="notice notice--problem">{t('practice.notFound')}</p>
        <Link to="/songs">{t('practice.backHome')}</Link>
      </section>
    );
  }
  return <SongLoader key={songId} songId={songId} />;
}

function SongLoader({ songId }: { songId: SongId }) {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const range = useSettings((s) => s.vocalRange);
  const [state, setState] = useState<LoadState>({ status: LoadStatus.Loading });
  useTopBarDetail(ts(`${songId}.title`));

  useEffect(() => {
    let cancelled = false;
    loadSong(songId).then(
      (score) => {
        const parts = songParts(score);
        if (!cancelled) {
          setState(parts ? { status: LoadStatus.Ready, parts } : { status: LoadStatus.Error });
        }
      },
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: LoadStatus.Error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [songId]);

  if (state.status === LoadStatus.Loading) return null;
  if (state.status === LoadStatus.Error) {
    return (
      <section className="screen">
        <p className="notice notice--problem">{t('practice.loadError')}</p>
        <Link to="/songs">{t('practice.backHome')}</Link>
      </section>
    );
  }
  const heading = (
    <div>
      <h1>{ts(`${songId}.title`)}</h1>
      <p className="muted">{ts(`${songId}.composer`)}</p>
    </div>
  );
  if (!range) {
    return (
      <section className="screen">
        {heading}
        <p className="notice">
          {t('sing.noRange')} <Link to="/settings#voice">{t('tuner.findRange')}</Link>
        </p>
        <SongWords score={state.parts.melody} />
      </section>
    );
  }
  return <SongPractice songId={songId} parts={state.parts} range={range} heading={heading} />;
}

interface SongPracticeProps {
  songId: SongId;
  parts: SongParts;
  range: VocalRange;
  heading: React.ReactNode;
}

function SongPractice({ songId, parts, range, heading }: SongPracticeProps) {
  const { t } = useTranslation('screens');
  useMicWhileShown();
  useEffect(preloadAudio, []);
  const { melody, accompaniment } = parts;
  const fit = useMemo(() => fitToRange(melody, range), [melody, range]);
  const piano = useMemo(
    () => moveAccompaniment(melody, accompaniment, fit.semitones),
    [melody, accompaniment, fit.semitones],
  );
  const lyrics = useLyricsLanguage(melody);
  const { system } = useNoteNames();
  const [mode, setMode] = useState<SongMode>(SingMode.Along);
  const [view, setView] = useState<ScoreView>(ScoreView.Falling);
  const [notation, setNotation] = useState<SheetNotation>(() => startNotation(system, null));
  const [guide, setGuide] = useState(true);
  const [accompanied, setAccompanied] = useState(true);
  const [metronome, setMetronome] = useState(false);

  return (
    <section className="screen practice">
      <header className="practice__header">{heading}</header>
      <div className="practice__options">
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
        <ViewToggle view={view} onChange={setView} lane />
        {view === ScoreView.Sheet && (
          <NotationSelect
            notation={notation}
            onChange={setNotation}
            options={singNotations(system)}
          />
        )}
        <LyricsSelect score={melody} />
        <label className="checkbox" title={t(`sing.guideTip.${mode}`)}>
          <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
          {t('sing.guide')}
        </label>
        {mode === SingMode.Along && piano.length > 0 && (
          <label className="checkbox" title={t('voiceSongs.pianoTip')}>
            <input
              type="checkbox"
              checked={accompanied}
              onChange={(e) => setAccompanied(e.target.checked)}
            />
            {t('voiceSongs.piano')}
          </label>
        )}
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
        {!guide && <KeyNoteButton score={fit.score} />}
        <VolumeButton />
      </div>
      {view === ScoreView.Sheet && notation === SheetNotation.Syllables && (
        <MovableDoNote score={fit.score} />
      )}
      {!fit.fits && <p className="notice">{t('sing.beyondRange')}</p>}
      <SingRun
        // A new range or mode starts over.
        key={`${fit.semitones}:${mode}`}
        score={fit.score}
        mode={mode}
        cents={SING_CENTS}
        octave={false}
        guide={guide}
        metronome={metronome}
        view={view}
        notation={notation}
        {...(lyrics && { lyrics })}
        accompaniment={piano}
        accompanied={accompanied && piano.length > 0}
        onFinish={(summary, durationMs) =>
          void recordResult(ResultKind.VoiceSong, songId, {
            stars: summary.stars,
            accuracy: summary.accuracy,
            durationMs,
          })
        }
      />
      <SongWords score={melody} />
    </section>
  );
}
