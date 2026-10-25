/**
 * One run of a melody sung to the microphone (PLAN.md milestone 6.3): the session, transport,
 * guide melody and metronome, the lane (or sheet music) with the voice drawn through it, a small
 * tuner beside it, and the results with Listen and Compare. The voice's `PracticeRun`.
 */
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from 'react-i18next';
import { startAccompaniment } from '../../../audio/accompaniment';
import { audioIfReady, soundLeadMs, startAudio } from '../../../audio/audio';
import { startMetronome } from '../../../audio/metronome';
import { ScoreView, type SheetNotation } from '../../../content/lessons';
import {
  beatsPerMeasure,
  beatsToMs,
  countedBeat,
  Hand,
  type Score,
  type ScoreNote,
} from '../../../engine/score';
import { SingMode, type SingSummary, tuneLevel, TuneLevel } from '../../../engine/singing';
import { SingSession, SingStatus, type TrailPoint } from '../../../engine/singSession';
import { Transport } from '../../../engine/transport';
import { exactPitch } from '../../../engine/tuner';
import { HandFilter } from '../../../engine/session';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { subscribeMicReadings, useMic } from '../../../input/mic/micInput';
import { startVoiceRecording } from '../../../input/mic/voiceRecording';
import { activityTimer, recordPracticeTime } from '../../../storage/progress';
import { useSettings } from '../../../storage/settings';
import { pitchFromMidi } from '../../../theory/pitch';
import { Modal } from '../../components/Modal';
import { useAnimationFrame } from '../../hooks';
import { ICONS } from '../../icons';
import { NoteStyle } from '../../keyboard/styles';
import { SheetMusic } from '../../sheet/SheetMusic';
import { Needle } from '../TunerParts';
import { SingCompare } from './SingCompare';
import { SingLane } from './SingLane';
import { SingResults } from './SingResults';

/** Seconds of music shown ahead of where notes are due. */
const SECONDS_AHEAD = 4;
/** Before starting, the first notes are already on their way. */
const LEAD_IN_SECONDS = 1.5;
/**
 * Wait for me: how long the app plays a note (ms), at least, and, through speakers, how long it
 * lets it ring before listening.
 */
const GUIDE_NOTE_MS = 1000;
const RING_MS = 400;
/** A note starts this long after asking, so it's never cut (ms). */
const START_DELAY_MS = 150;

interface SingRunProps {
  /** The melody, already in the singer's range. */
  score: Score;
  mode: SingMode;
  /** In tune within this many cents; only the written octave when `octave`. */
  cents: number;
  octave: boolean;
  /**
   * The app plays the melody along; waiting, it plays it first, quickly, and with headphones each
   * note too, as it's sung.
   */
  guide: boolean;
  /** The metronome clicks the beat (singing along). */
  metronome: boolean;
  view: ScoreView;
  notation: SheetNotation;
  onFinish?: (summary: SingSummary, durationMs: number) => void;
  /** Extra buttons on the results (e.g. Continue in a lesson). */
  resultsActions?: (summary: SingSummary) => ReactNode;
}

export function SingRun({
  score,
  mode,
  cents,
  octave,
  guide,
  metronome,
  view,
  notation,
  onFinish,
  resultsActions,
}: SingRunProps) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const headphones = useSettings((s) => s.headphones);
  const [transport] = useState(() => new Transport(score.tempo));
  const [session] = useState(
    () =>
      new SingSession(score, transport, { mode, cents, octave, leadInSeconds: LEAD_IN_SECONDS }),
  );
  const state = useSyncExternalStore(session.subscribe, session.getState);
  const running =
    state.status === SingStatus.Playing ||
    state.status === SingStatus.Waiting ||
    state.status === SingStatus.Listening;
  const [dismissed, setDismissed] = useState<SingSummary | null>(null);
  const [comparing, setComparing] = useState(false);
  /** The last run: its audio to listen to, and the line of the voice to compare. */
  const [take, setTake] = useState<{ url: string; trail: readonly TrailPoint[] } | null>(null);
  const [playingBack, setPlayingBack] = useState(false);
  const recorder = useRef<ReturnType<typeof startVoiceRecording> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const startedAt = useRef(0);

  useEffect(
    () =>
      subscribeMicReadings((reading, time) =>
        session.reading(reading ? exactPitch(reading) : null, time),
      ),
    [session],
  );
  useAnimationFrame(() => session.tick());
  useEffect(() => () => session.pause(), [session]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') session.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  // Practice time: while singing, not counting long silences.
  useEffect(() => {
    if (!running) return;
    const timer = activityTimer();
    const unsubscribe = subscribeMicReadings((reading) => {
      if (reading) timer.activity();
    });
    return () => {
      unsubscribe();
      void recordPracticeTime(timer.stop());
    };
  }, [running]);

  // The guide and the metronome read the latest choices without restarting.
  const guideOn = useRef(guide);
  const metronomeOn = useRef(metronome);
  useEffect(() => {
    guideOn.current = guide;
    metronomeOn.current = metronome;
    session.setPreview(guide);
  }, [guide, metronome, session]);
  useEffect(
    () =>
      startMetronome(
        transport,
        () => ({
          metronome: metronomeOn.current && mode !== SingMode.Wait && !session.appPlays,
          countInFrom: session.countInFrom,
          musicStart: 0,
          beatsPerMeasure: beatsPerMeasure(score.timeSignature),
          every: countedBeat(score.timeSignature),
          holdBeat: session.holdBeat,
        }),
        (time, accent) => audioIfReady()?.click(time, accent),
        soundLeadMs,
      ),
    [transport, session, score, mode],
  );
  // The melody: played first (Listen first), or along when the guide is on.
  useEffect(
    () =>
      startAccompaniment(
        transport,
        () => ({
          enabled: session.appPlays || (mode === SingMode.Along && guideOn.current),
          notes: score.notes,
          from: 0,
          until: Infinity,
        }),
        (note, start, end) => audioIfReady()?.accompany(note.pitch.midi, start, end),
        soundLeadMs,
      ),
    [transport, session, score, mode],
  );
  useEffect(() => {
    if (!running) audioIfReady()?.stopAccompaniment();
  }, [running]);

  // Wait for me: the app plays a note when asked (Hear it again), and with headphones and the guide
  // on, each one as it comes, while it's sung. Through speakers the microphone would hear it, so
  // it listens once the note has stopped ringing.
  const headphonesOn = useRef(headphones);
  useEffect(() => {
    headphonesOn.current = headphones;
  }, [headphones]);
  const playNote = useCallback(
    async (note: ScoreNote) => {
      const engine = await startAudio().catch((error: unknown) => {
        console.warn('No audio', error);
        return null;
      });
      if (!engine) {
        session.listenFrom(performance.now());
        return;
      }
      const start = performance.now() + START_DELAY_MS + soundLeadMs();
      const length = Math.max(GUIDE_NOTE_MS, beatsToMs(note.duration, score.tempo));
      engine.accompany(note.pitch.midi, start, start + length);
      session.listenFrom(
        headphonesOn.current
          ? performance.now()
          : start + length + engine.outputDelayMs() + RING_MS,
      );
    },
    [session, score],
  );
  const waitingFor = state.status === SingStatus.Waiting ? session.waitingFor : undefined;
  useEffect(() => {
    if (!waitingFor) return;
    if (guideOn.current && headphonesOn.current) void playNote(waitingFor);
    else session.listenFrom(performance.now());
  }, [waitingFor, playNote, session]);

  // A run that ends keeps its audio, to listen to, and its line, to compare.
  const finished = useRef(onFinish);
  useEffect(() => {
    finished.current = onFinish;
  });
  useEffect(() => {
    if (!state.summary) return;
    recorder.current?.stop();
    const file = recorder.current?.save() ?? null;
    recorder.current = null;
    setTake(file ? { url: URL.createObjectURL(file), trail: [...session.trail] } : null);
    finished.current?.(state.summary, performance.now() - startedAt.current);
  }, [state.summary, session]);
  useEffect(
    () => () => {
      recorder.current?.stop();
      player.current?.pause();
    },
    [],
  );
  useEffect(() => () => (take ? URL.revokeObjectURL(take.url) : undefined), [take]);

  const stopListening = () => {
    player.current?.pause();
    player.current = null;
    setPlayingBack(false);
  };
  const listen = () => {
    if (!take) return;
    stopListening();
    const audio = new Audio(take.url);
    audio.addEventListener('ended', () => setPlayingBack(false));
    player.current = audio;
    setPlayingBack(true);
    void audio.play().catch(() => setPlayingBack(false));
  };

  const togglePlay = async () => {
    if (running) {
      session.pause();
      return;
    }
    stopListening();
    if (state.status === SingStatus.Ready || state.status === SingStatus.Finished) {
      startedAt.current = performance.now();
      recorder.current?.stop();
      recorder.current = startVoiceRecording(useMic.getState().gateDb);
    }
    await startAudio().catch((error: unknown) => console.warn('No audio', error));
    session.play();
  };
  const restart = () => {
    recorder.current?.stop();
    recorder.current = null;
    session.restart();
  };

  // What's drawn every frame: stable functions reading the session.
  const levelOf = useCallback(
    (note: ScoreNote) => {
      const result = session.resultOf(note);
      return result && tuneLevel(result);
    },
    [session],
  );
  const trail = useCallback(() => session.trail, [session]);
  const voice = useCallback(() => {
    const now = session.getState().voice;
    if (!now) return null;
    return { pitch: session.drawnPitch(now.pitch, now.target), inTune: now.inTune };
  }, [session]);
  const labelFor = useCallback(
    (midi: number) =>
      names.name(pitchFromMidi(midi, { keyFifths: score.keyFifths }), { octave: false }),
    [names, score],
  );
  const styleOf = useCallback(
    (note: ScoreNote): NoteStyle | undefined => {
      const level = levelOf(note);
      return level === TuneLevel.Good
        ? NoteStyle.Played
        : level === TuneLevel.Partly
          ? NoteStyle.Partly
          : level === TuneLevel.Off
            ? NoteStyle.Missed
            : undefined;
    },
    [levelOf],
  );

  const target = state.voice?.target ?? waitingFor?.pitch.midi ?? null;
  const message =
    state.status === SingStatus.Listening
      ? t('sing.listening')
      : waitingFor
        ? state.voice?.cents == null
          ? t('sing.waiting', { note: labelFor(waitingFor.pitch.midi) })
          : state.voice.inTune
            ? t('tuner.match.hold')
            : state.voice.cents < 0
              ? t('tuner.match.higher')
              : t('tuner.match.lower')
        : running
          ? t(mode === SingMode.Wait ? 'sing.nextNote' : 'sing.singing')
          : t(`sing.hint.${mode}`);
  const resultsOpen = state.summary !== null && dismissed !== state.summary;
  const tempo = mode !== SingMode.Wait;

  return (
    <>
      <div className="practice__controls">
        <button
          type="button"
          className="button button--primary button--icon"
          onClick={() => void togglePlay()}
          aria-label={running ? t('practice.pause') : t('practice.play')}
          title={running ? t('practice.pause') : t('practice.play')}
        >
          <span aria-hidden="true">{running ? ICONS.pause : ICONS.play}</span>
        </button>
        <button
          type="button"
          className="button button--icon"
          onClick={restart}
          aria-label={t('practice.restart')}
          title={t('practice.restart')}
        >
          <span aria-hidden="true">{ICONS.restart}</span>
        </button>
        {waitingFor && (
          <>
            <button type="button" className="button" onClick={() => void playNote(waitingFor)}>
              <span className="button__icon" aria-hidden="true">
                {ICONS.volume}
              </span>
              {t('tuner.match.hearAgain')}
            </button>
            <button type="button" className="button" onClick={() => session.skip()}>
              {t('tuner.match.skip')}
            </button>
          </>
        )}
        {!running && take && (
          <>
            <button
              type="button"
              className="button"
              title={t('sing.listenTip')}
              onClick={playingBack ? stopListening : listen}
            >
              <span className="button__icon" aria-hidden="true">
                {playingBack ? ICONS.stop : ICONS.listen}
              </span>
              {playingBack ? t('sing.stopListening') : t('practice.recording.listen')}
            </button>
            {tempo && (
              <button
                type="button"
                className="button"
                title={t('sing.compareTip')}
                onClick={() => setComparing(true)}
              >
                <span className="button__icon" aria-hidden="true">
                  {ICONS.compare}
                </span>
                {t('practice.recording.compare')}
              </button>
            )}
          </>
        )}
        {state.summary && !resultsOpen && (
          <button type="button" className="button" onClick={() => setDismissed(null)}>
            {t('practice.results.show')}
          </button>
        )}
        <p className="muted" aria-live="polite">
          {message}
        </p>
      </div>
      {mode === SingMode.Along && guide && !headphones && (
        <p className="notice">{t('sing.headphones')}</p>
      )}

      {state.summary && resultsOpen && (
        <Modal labelledBy="sing-results" onClose={() => setDismissed(state.summary)}>
          <SingResults
            summary={state.summary}
            labelFor={(midi) =>
              names.name(pitchFromMidi(midi, { keyFifths: score.keyFifths }), { octave: true })
            }
            onRetry={() => {
              setDismissed(state.summary);
              restart();
              void togglePlay();
            }}
          >
            {take && (
              <button
                type="button"
                className="button"
                title={t('sing.listenTip')}
                onClick={() => {
                  setDismissed(state.summary);
                  listen();
                }}
              >
                {t('practice.recording.listen')}
              </button>
            )}
            {take && tempo && (
              <button
                type="button"
                className="button"
                title={t('sing.compareTip')}
                onClick={() => {
                  setDismissed(state.summary);
                  setComparing(true);
                }}
              >
                {t('practice.recording.compare')}
              </button>
            )}
            {resultsActions?.(state.summary)}
          </SingResults>
        </Modal>
      )}
      {comparing && take && (
        <Modal labelledBy="sing-compare" wide onClose={() => setComparing(false)}>
          <section className="compare-card">
            <h2 id="sing-compare">{t('practice.recording.heading')}</h2>
            <p className="muted">{t('sing.compareIntro')}</p>
            <SingCompare score={score} trail={take.trail} labelFor={labelFor} />
          </section>
        </Modal>
      )}

      <div className="sing__stage">
        <div className="practice__notes sing__notes">
          {view === ScoreView.Sheet ? (
            <SheetMusic
              score={score}
              transport={transport}
              styleOf={styleOf}
              outcomesVersion={state}
              notation={notation}
              hands={score.notes[0]?.hand === Hand.Left ? HandFilter.Left : HandFilter.Right}
            />
          ) : (
            <SingLane
              score={score}
              transport={transport}
              secondsAhead={SECONDS_AHEAD}
              labelFor={labelFor}
              levelOf={levelOf}
              trail={trail}
              voice={voice}
            />
          )}
          {state.countIn !== null && (
            <div className="count-in" aria-live="assertive">
              {state.countIn}
            </div>
          )}
        </div>
        <div className="sing__tuner" aria-live="off">
          <strong className="sing__target">{target === null ? '–' : labelFor(target)}</strong>
          <span className={state.voice?.cents == null ? 'sing__needle is-idle' : 'sing__needle'}>
            <Needle cents={state.voice?.cents ?? 0} zone={cents} span={100} />
          </span>
          {waitingFor && (
            <span className="hold-bar">
              <span style={{ inlineSize: `${Math.round(state.held * 100)}%` }} />
            </span>
          )}
          <span className="muted">
            {state.voice?.cents == null
              ? t('sing.notHeard')
              : t('sing.cents', { cents: state.voice.cents })}
          </span>
        </div>
      </div>
    </>
  );
}
