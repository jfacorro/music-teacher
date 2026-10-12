import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { audioIfReady, startAudio } from '../../../audio/audio';
import { startMetronome } from '../../../audio/metronome';
import { beatsPerMeasure, type Score, type ScoreNote } from '../../../engine/score';
import { PracticeSession, type HandFilter, type PracticeMode } from '../../../engine/session';
import { Transport } from '../../../engine/transport';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { subscribeNotes } from '../../../input/bus';
import { screenKeyDown, screenKeyUp } from '../../../input/dev/screenInput';
import { useInstrument } from '../../../input/routing';
import { pitchFromMidi } from '../../../theory/pitch';
import { useActiveNotes, useAnimationFrame, usePressedKeys } from '../../hooks';
import { FallingNotes, type NoteStyle } from '../../keyboard/FallingNotes';
import { keyboardLayout, rangeForNotes } from '../../keyboard/layout';
import { PianoKeyboard, type ExpectedKey } from '../../keyboard/PianoKeyboard';
import { FeedbackBadge } from './FeedbackBadge';
import { ResultsCard } from './ResultsCard';

const SECONDS_VISIBLE = 3;
/** Start with the first notes near the top, so they're visible before pressing Play. */
const LEAD_IN_SCREENS = 0.8;

interface PracticeRunProps {
  score: Score;
  mode: PracticeMode;
  hands: HandFilter;
  metronome: boolean;
}

/** One practice run: session, transport, input, metronome and the stage. */
export function PracticeRun({ score, mode, hands, metronome }: PracticeRunProps) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();

  const [transport] = useState(() => new Transport(score.tempo));
  const [session] = useState(
    () =>
      new PracticeSession(score, transport, {
        mode,
        hands,
        leadIn: (LEAD_IN_SCREENS * SECONDS_VISIBLE * score.tempo) / 60,
        // Timing windows before the first note arrives: wider for the microphone.
        defaultSource: useInstrument.getState().instrument === 'mic' ? 'mic' : 'midi',
      }),
  );
  const state = useSyncExternalStore(session.subscribe, session.getState);
  const running = state.status === 'playing' || state.status === 'waiting';

  useEffect(() => subscribeNotes((event) => session.handleNote(event)), [session]);
  useEffect(() => () => session.pause(), [session]);
  useAnimationFrame(() => session.tick());

  // The metronome reads the latest choice without restarting.
  const metronomeOn = useRef(metronome);
  useEffect(() => {
    metronomeOn.current = metronome;
  }, [metronome]);
  useEffect(
    () =>
      startMetronome(
        transport,
        () => ({
          metronome: metronomeOn.current,
          countInFrom: session.countInFrom,
          beatsPerMeasure: beatsPerMeasure(score.timeSignature),
        }),
        (time, accent) => audioIfReady()?.click(time, accent),
      ),
    [transport, session, score],
  );

  const layout = useMemo(
    () => keyboardLayout(...rangeForNotes(score.notes.map((note) => note.pitch.midi))),
    [score],
  );
  // Light up the keys to play now: sounding notes that haven't been played yet. Outcomes
  // change with the session state, so recompute on both.
  const active = useActiveNotes(session.graded, transport);
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
  const pressed = usePressedKeys();

  const keyLabel = useCallback(
    (midi: number) => names.name(pitchFromMidi(midi), { octave: false }),
    [names],
  );
  // Falling notes use the score's own spelling (a written D♭ stays D♭).
  const noteLabel = useCallback(
    (note: ScoreNote) => names.name(note.pitch, { octave: false }),
    [names],
  );
  const styleOf = useCallback(
    (note: ScoreNote): NoteStyle => {
      if (!session.isGraded(note)) return 'muted';
      const outcome = session.outcomeOf(note);
      if (!outcome) return undefined;
      return outcome.kind === 'missed' ? 'missed' : 'played';
    },
    [session],
  );

  const togglePlay = async () => {
    if (running) {
      session.pause();
      return;
    }
    // Audio may only start from a click; wait for it so the count-in's first click is heard.
    await startAudio().catch((error: unknown) => console.warn('No audio', error));
    session.play();
  };

  return (
    <>
      <div className="practice__controls">
        <button type="button" className="button button--primary" onClick={() => void togglePlay()}>
          {running ? t('practice.pause') : t('practice.play')}
        </button>
        <button type="button" className="button" onClick={() => session.restart()}>
          {t('practice.restart')}
        </button>
        <p className="muted">{mode === 'wait' ? t('practice.hintWait') : t('practice.hint')}</p>
      </div>

      <div className="practice__stage">
        <div className="practice__notes">
          <FallingNotes
            score={score}
            transport={transport}
            layout={layout}
            secondsVisible={SECONDS_VISIBLE}
            labelFor={noteLabel}
            styleOf={styleOf}
          />
          {!state.summary && <FeedbackBadge feedback={state.feedback} streak={state.streak} />}
          {state.countIn !== null && (
            <div className="count-in" aria-live="assertive">
              {state.countIn}
            </div>
          )}
        </div>
        <PianoKeyboard
          layout={layout}
          pressed={pressed}
          expected={expected}
          marks={state.marks}
          labels="white"
          labelFor={keyLabel}
          onKeyDown={screenKeyDown}
          onKeyUp={screenKeyUp}
        />
        {state.summary && (
          <ResultsCard
            summary={state.summary}
            mode={mode}
            onRetry={() => {
              session.restart();
              void togglePlay();
            }}
          />
        )}
      </div>
    </>
  );
}
