import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { startAccompaniment } from '../../../audio/accompaniment';
import { audioIfReady, soundLeadMs, startAudio } from '../../../audio/audio';
import { startMetronome } from '../../../audio/metronome';
import { beatsPerMeasure, type Score, type ScoreNote } from '../../../engine/score';
import { type Summary, OutcomeKind } from '../../../engine/scoring';
import {
  PracticeSession,
  type HandFilter,
  type LoopRange,
  PracticeMode,
  SessionStatus,
} from '../../../engine/session';
import { Transport } from '../../../engine/transport';
import { weakSpot } from '../../../engine/weakSpots';
import { formatPercent } from '../../../i18n/format';
import { isTypingTarget } from '../../../input/dev/devInput';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { subscribeNotes } from '../../../input/bus';
import { screenKeyDown, screenKeyUp } from '../../../input/dev/screenInput';
import { useInstrument, Instrument } from '../../../input/routing';
import { groupByStart } from '../../../engine/matching/waitMatcher';
import { pitchFromMidi } from '../../../theory/pitch';
import { useLiveInput } from '../../../input/liveStore';
import { activityTimer, recordPracticeTime } from '../../../storage/progress';
import { toggleBars } from '../../barSelection';
import { Modal } from '../../components/Modal';
import { ICONS } from '../../icons';
import { useActiveNotes, useAnimationFrame } from '../../hooks';
import { FallingNotes } from '../../keyboard/FallingNotes';
import { KeyLabels, NoteStyle } from '../../keyboard/styles';
import { keyboardLayout, rangeForNotes } from '../../keyboard/layout';
import { PianoKeyboard, type ExpectedKey } from '../../keyboard/PianoKeyboard';
import { TapPad } from '../../keyboard/TapPad';
import { ScoreView, type SheetNotation } from '../../../content/lessons';
import { SheetMusic } from '../../sheet/SheetMusic';
import { FeedbackBadge } from './FeedbackBadge';
import { DynamicsNow } from './DynamicsNow';
import { PedalIndicator } from '../../components/PedalIndicator';
import { ResultsCard } from './ResultsCard';
import { InputSource } from '../../../input/types';

const SECONDS_VISIBLE = 3;
/** Start with the first notes near the top, so they're visible before pressing Play. */
const LEAD_IN_SCREENS = 0.8;

interface PracticeRunProps {
  score: Score;
  mode: PracticeMode;
  hands: HandFilter;
  metronome: boolean;
  view: ScoreView;
  notation: SheetNotation;
  /** Percent of the score's tempo (default 100). */
  speed?: number;
  /** Bars to repeat, or null for the whole score. */
  loop?: LoopRange | null;
  /** Play the hand that isn't practiced. */
  otherHand?: boolean;
  /**
   * A rhythm exercise: any key counts, shown on a one-line staff or a single lane, with a tap
   * pad in place of the keyboard.
   */
  rhythm?: boolean;
  /**
   * Asks for a loop: bars chosen on the music (null: chosen again, to stop repeating them), or
   * the weak spot after a run. Without it, neither is offered.
   */
  onLoopChange?: (range: LoopRange | null) => void;
  /** Instruction shown next to the controls (defaults to a tip for the mode). */
  hint?: string;
  /** Called once when the run ends, with its results and how long it took (ms). */
  onFinish?: (summary: Summary, durationMs: number) => void;
  /** Called each time through the repeated bars, with how many times so far. */
  onLoopPass?: (count: number) => void;
  /** Extra buttons on the results card (e.g. Continue in a lesson). */
  resultsActions?: (summary: Summary) => ReactNode;
}

/** One practice run: session, transport, input, metronome and the stage. */
export function PracticeRun({
  score,
  mode,
  hands,
  metronome,
  view,
  notation,
  speed = 100,
  loop = null,
  otherHand = false,
  rhythm = false,
  onLoopChange,
  hint,
  onFinish,
  onLoopPass,
  resultsActions,
}: PracticeRunProps) {
  const { t, i18n } = useTranslation('screens');
  const names = useNoteNames();

  const [transport] = useState(() => new Transport((score.tempo * speed) / 100));
  const [session] = useState(
    () =>
      new PracticeSession(score, transport, {
        mode,
        hands,
        leadInSeconds: LEAD_IN_SCREENS * SECONDS_VISIBLE,
        loop,
        anyKey: rhythm,
        // Timing windows before the first note arrives: wider for the microphone.
        defaultSource:
          useInstrument.getState().instrument === Instrument.Mic
            ? InputSource.Mic
            : InputSource.Midi,
      }),
  );
  const state = useSyncExternalStore(session.subscribe, session.getState);
  const autoplay = mode === PracticeMode.Autoplay;
  /** Results the learner closed (they stay closed until the next run's). */
  const [dismissed, setDismissed] = useState<Summary | null>(null);
  const running = state.status === SessionStatus.Playing || state.status === SessionStatus.Waiting;

  useEffect(() => subscribeNotes((event) => session.handleNote(event)), [session]);
  useEffect(() => () => session.pause(), [session]);
  useAnimationFrame(() => session.tick());
  // Hidden pages get no animation frames, so nothing would be checked: pause instead of
  // piling up missed notes while the user is away.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') session.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  // Practice time: while playing (or waiting for a key), not counting long idle stretches.
  useEffect(() => {
    if (!running) return;
    const timer = activityTimer();
    const unsubscribe = subscribeNotes(timer.activity);
    return () => {
      unsubscribe();
      void recordPracticeTime(timer.stop());
    };
  }, [running]);

  // A new loop starts over; a new speed carries on from where it is.
  const loopFirst = loop?.first;
  const loopLast = loop?.last;
  useEffect(() => {
    session.setLoop(
      loopFirst === undefined || loopLast === undefined
        ? null
        : { first: loopFirst, last: loopLast },
    );
  }, [session, loopFirst, loopLast]);
  useEffect(() => session.setTempo((score.tempo * speed) / 100), [session, score, speed]);

  const passed = useRef(onLoopPass);
  useEffect(() => {
    passed.current = onLoopPass;
  });
  const passes = state.lastPass?.count ?? 0;
  useEffect(() => {
    if (passes > 0) passed.current?.(passes);
  }, [passes]);

  const finished = useRef(onFinish);
  const startedAt = useRef(0);
  useEffect(() => {
    finished.current = onFinish;
  });
  useEffect(() => {
    if (state.summary) finished.current?.(state.summary, performance.now() - startedAt.current);
  }, [state.summary]);

  // The metronome and the other hand read the latest choices without restarting.
  const metronomeOn = useRef(metronome);
  const otherHandOn = useRef(otherHand);
  useEffect(() => {
    metronomeOn.current = metronome;
    otherHandOn.current = otherHand;
  }, [metronome, otherHand]);
  useEffect(
    () =>
      startMetronome(
        transport,
        () => ({
          metronome: metronomeOn.current,
          countInFrom: session.countInFrom,
          musicStart: session.musicStart,
          loopEnd: session.looping ? session.musicEnd : null,
          beatsPerMeasure: beatsPerMeasure(score.timeSignature),
        }),
        (time, accent) => audioIfReady()?.click(time, accent),
        soundLeadMs,
      ),
    [transport, session, score],
  );
  // The other hand, or in autoplay the practiced hands (and the other one if chosen).
  useEffect(
    () =>
      startAccompaniment(
        transport,
        () => ({
          enabled: autoplay || otherHandOn.current,
          notes: autoplay ? (otherHandOn.current ? score.notes : session.hands) : session.otherHand,
          from: session.musicStart,
          until: Math.min(session.holdBeat, session.musicEnd),
        }),
        (note, start, end) => audioIfReady()?.accompany(note.pitch.midi, start, end),
        soundLeadMs,
      ),
    [transport, session, score, autoplay],
  );
  // Waiting for a key keeps the other hand ringing; stopping silences it.
  useEffect(() => {
    if (!running || !(otherHand || autoplay)) audioIfReady()?.stopAccompaniment();
  }, [running, otherHand, autoplay]);

  // A rhythm's notes are all on one key: a single lane.
  const rhythmKey = score.notes[0]?.pitch.midi ?? 64;
  // The keys of the hands being practiced, and of the other hand when it's played along.
  const shown = otherHand ? score.notes : session.hands;
  const layout = useMemo(
    () =>
      rhythm
        ? keyboardLayout(rhythmKey, rhythmKey)
        : keyboardLayout(...rangeForNotes(shown.map((note) => note.pitch.midi))),
    [shown, rhythm, rhythmKey],
  );
  // Light up the keys to play now: sounding notes that haven't been played yet. Outcomes
  // change with the session state, so recompute on both.
  const active = useActiveNotes(session.practiced, transport);
  const expected = useMemo(
    () =>
      new Map<number, ExpectedKey>(
        active
          .filter((note) => !session.outcomeOf(note))
          .map((note) => [note.pitch.midi, { hand: note.hand, finger: note.finger }]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `state` signals new outcomes
    [active, session, state],
  );
  // Held keys; a microphone note read as an expected note lights up that key.
  const held = useLiveInput((s) => s.held);
  const pressed = useMemo(
    () =>
      new Set(
        held.map((note) =>
          note.source === InputSource.Mic ? session.displayPitch(note.pitch) : note.pitch,
        ),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `state` signals new aliases
    [held, session, state],
  );

  const keyLabel = useCallback(
    (midi: number) => names.name(pitchFromMidi(midi), { octave: false }),
    [names],
  );
  // Falling notes use the score's own spelling (a written D♭ stays D♭).
  const noteLabel = useCallback(
    (note: ScoreNote) => (rhythm ? '' : names.name(note.pitch, { octave: false })),
    [names, rhythm],
  );
  const styleOf = useCallback(
    (note: ScoreNote): NoteStyle | undefined => {
      if (!session.isGraded(note)) return NoteStyle.Muted;
      const outcome = session.outcomeOf(note);
      if (!outcome) return undefined;
      return outcome.kind === OutcomeKind.Missed ? NoteStyle.Missed : NoteStyle.Played;
    },
    [session],
  );

  const togglePlay = async () => {
    if (running) {
      session.pause();
      return;
    }
    if (state.status === SessionStatus.Ready || state.status === SessionStatus.Finished)
      startedAt.current = performance.now();
    // Audio may only start from a click; wait for it so the count-in's first click is heard.
    await startAudio().catch((error: unknown) => console.warn('No audio', error));
    session.play();
  };

  // Shortcuts: Space plays and pauses, Escape starts over.
  const latestTogglePlay = useRef(togglePlay);
  useEffect(() => {
    latestTogglePlay.current = togglePlay;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Escape') return;
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // An open dialog (the results) or panel (volume) handles its own keys: Escape closes it.
      if (document.querySelector('dialog:modal, :popover-open')) return;
      event.preventDefault(); // no page scrolling
      // A focused button or checkbox would react to Space as well, when the key comes up.
      if (event.target instanceof HTMLElement && event.target !== document.body) {
        event.target.blur();
      }
      if (event.code === 'Space') void latestTogglePlay.current();
      else session.restart();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session]);

  // Bars can be chosen on the music while it isn't playing.
  const selectBars =
    running || !onLoopChange
      ? undefined
      : (range: LoopRange) => onLoopChange(toggleBars(loop, range));
  const weak = state.summary && onLoopChange ? weakSpot(state.summary.measures) : null;
  const resultsOpen = state.summary !== null && dismissed !== state.summary;
  const extraActions = state.summary ? (resultsActions?.(state.summary) ?? null) : null;

  // The microphone hears one note at a time: with it, any note of a chord counts.
  const listening = useInstrument((s) => s.instrument);
  const micChords =
    listening === Instrument.Mic &&
    !rhythm &&
    !autoplay &&
    groupByStart(session.practiced).some((group) => group.notes.length > 1);

  const modeHint = rhythm
    ? t('practice.hintRhythm')
    : mode === PracticeMode.Wait
      ? t('practice.hintWait')
      : autoplay
        ? t('practice.hintAutoplay')
        : t('practice.hint');
  const loopHint =
    loop &&
    [
      t('practice.loop.hint'),
      state.lastPass &&
        t('practice.loop.lastPass', {
          count: state.lastPass.count,
          accuracy: formatPercent(state.lastPass.accuracy, i18n.language),
        }),
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <>
      <div className="practice__controls">
        <button
          type="button"
          className="button button--primary button--icon"
          onClick={() => void togglePlay()}
          aria-label={running ? t('practice.pause') : t('practice.play')}
          aria-keyshortcuts="Space"
          title={t('practice.tips.withKey', {
            action: running ? t('practice.pause') : t('practice.play'),
            key: t('practice.keys.space'),
          })}
        >
          <span aria-hidden="true">{running ? ICONS.pause : ICONS.play}</span>
        </button>
        <button
          type="button"
          className="button button--icon"
          onClick={() => session.restart()}
          aria-label={t('practice.restart')}
          aria-keyshortcuts="Escape"
          title={t('practice.tips.withKey', {
            action: t('practice.restart'),
            key: t('practice.keys.escape'),
          })}
        >
          <span aria-hidden="true">{ICONS.restart}</span>
        </button>
        {state.summary && !resultsOpen && (
          <button
            type="button"
            className="button"
            title={t('practice.tips.showResults')}
            onClick={() => setDismissed(null)}
          >
            {t('practice.results.show')}
          </button>
        )}
        <p className="muted" aria-live="polite">
          {hint ?? (loopHint || modeHint)}
        </p>
        {score.dynamics && !rhythm && (
          <DynamicsNow dynamics={score.dynamics} transport={transport} />
        )}
      </div>

      {micChords && <p className="notice practice__notice">{t('practice.micChords')}</p>}

      {/* Results float over the page; closed, the music stays with its colored notes. */}
      {state.summary && resultsOpen && (
        <Modal labelledBy="results-heading" onClose={() => setDismissed(state.summary)}>
          <ResultsCard
            summary={state.summary}
            mode={mode}
            rhythm={rhythm}
            onRetry={() => {
              session.restart();
              void togglePlay();
            }}
            onSelectBar={onLoopChange && ((bar) => onLoopChange({ first: bar, last: bar }))}
            hasDynamics={score.dynamics !== undefined}
          >
            {weak || extraActions ? (
              <>
                {weak && onLoopChange && (
                  <button
                    type="button"
                    className="button"
                    title={t('practice.tips.weakSpot')}
                    onClick={() => onLoopChange(weak)}
                  >
                    {t('practice.results.weakSpot')}
                  </button>
                )}
                {extraActions}
              </>
            ) : null}
          </ResultsCard>
        </Modal>
      )}
      <div className="practice__stage">
        <div className="practice__notes">
          {view === ScoreView.Sheet ? (
            <SheetMusic
              score={score}
              transport={transport}
              styleOf={styleOf}
              outcomesVersion={state}
              notation={notation}
              hands={hands}
              loop={loop}
              onSelectBars={selectBars}
              rhythm={rhythm}
            />
          ) : (
            <FallingNotes
              score={score}
              transport={transport}
              layout={layout}
              secondsVisible={SECONDS_VISIBLE}
              labelFor={noteLabel}
              styleOf={styleOf}
              loop={loop}
              onSelectBars={selectBars}
            />
          )}
          {!state.summary && <FeedbackBadge feedback={state.feedback} streak={state.streak} />}
          <div className="stage-status">
            <PedalIndicator />
          </div>
          {state.countIn !== null && (
            <div className="count-in" aria-live="assertive">
              {state.countIn}
            </div>
          )}
        </div>
        {rhythm ? (
          <TapPad
            pitch={rhythmKey}
            due={expected.size > 0}
            pressed={held.length > 0}
            mark={state.marks.get(rhythmKey)}
          />
        ) : (
          <PianoKeyboard
            layout={layout}
            pressed={pressed}
            expected={expected}
            marks={state.marks}
            labels={KeyLabels.White}
            labelFor={keyLabel}
            onKeyDown={screenKeyDown}
            onKeyUp={screenKeyUp}
          />
        )}
      </div>
    </>
  );
}
