/**
 * One ear-training exercise (PLAN.md milestone 4.4): each question is played, then answered on
 * the keyboard (or, for chords, by choosing major or minor; for rhythms, by tapping any key).
 * Wrong keys say which note they were; after two the key to play lights up (for a rhythm, how
 * many notes it has). Scored by the questions answered without a miss.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioIfReady, soundLeadMs, startAudio } from '../../../audio/audio';
import {
  Answer,
  answerChord,
  answerNote,
  answerQuality,
  answerRhythm,
  type ChordKind,
  EarLevel,
  type EarQuestion,
  type EarRange,
  earQuestions,
  hintKey,
  promptLength,
  promptNotes,
} from '../../../content/earTraining';
import { quizResult, type QuizResult } from '../../../engine/quiz';
import { KeyMark } from '../../../engine/session';
import { Hand } from '../../../engine/score';
import { formatPercent } from '../../../i18n/format';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { subscribeNotes } from '../../../input/bus';
import { screenKeyDown, screenKeyUp } from '../../../input/dev/screenInput';
import { useLiveInput } from '../../../input/liveStore';
import { ignoreMicUntil } from '../../../input/mic/micInput';
import { Instrument, useInstrument } from '../../../input/routing';
import { NoteEventType } from '../../../input/types';
import { activityTimer, recordPracticeTime } from '../../../storage/progress';
import { ChordQuality, identifyInterval } from '../../../theory/chords';
import { MIDDLE_C, pitchClass, pitchFromMidi } from '../../../theory/pitch';
import { Stars } from '../../components/Stars';
import { QuizTally } from '../../quiz/QuizTally';
import { usePressedKeys } from '../../hooks';
import { ICONS } from '../../icons';
import { keyboardLayout, keyboardRange } from '../../keyboard/layout';
import { useSettings } from '../../../storage/settings';
import { type ExpectedKey, PianoKeyboard } from '../../keyboard/PianoKeyboard';
import { KeyLabels } from '../../keyboard/styles';
import { ShortcutButton } from '../../components/ShortcutButton';
import { ShortcutKey } from '../../shortcuts';

/** Pause on a right answer before the next question. */
const NEXT_QUESTION_MS = 1400;
/** Misses before the answer is shown. */
const HINT_AFTER = 2;
/** The first sound starts this long after asking, so it's never cut (ms). */
const START_DELAY_MS = 150;
/** How long the app's piano keeps ringing for the microphone after a question (ms). */
const RING_MS = 600;
const CHORD_KINDS: readonly ChordKind[] = [ChordQuality.Major, ChordQuality.Minor];
/** A rhythm's taps stop counting after a pause this long: tapping again starts over (ms). */
const TAPS_FORGOTTEN_MS = 3000;

interface EarExerciseProps {
  level: EarLevel;
  /** The keys questions can use (from the units finished). */
  range: EarRange;
  /** Single notes: play middle C first, as a reference. */
  reference: boolean;
  /** Called when the last question is answered, with how long it took (ms). */
  onFinish?: (result: QuizResult, durationMs: number) => void;
  /** A new exercise's questions, when not from `range` (e.g. in the singer's range). */
  makeQuestions?: () => EarQuestion[];
}

export function EarExercise({
  level,
  range,
  reference,
  onFinish,
  makeQuestions,
}: EarExerciseProps) {
  const { t, i18n } = useTranslation('screens');
  const { t: tt } = useTranslation('theory');
  const names = useNoteNames();
  const usingMic = useInstrument((s) => s.instrument) === Instrument.Mic;

  const newQuestions = () => (makeQuestions ? makeQuestions() : earQuestions(level, range));
  const [questions, setQuestions] = useState(newQuestions);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  /** Notes played back right so far. */
  const [played, setPlayed] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  /** Each question answered: right the first time, or not. */
  const [answers, setAnswers] = useState<boolean[]>([]);
  const firstTry = answers.filter(Boolean).length;
  /** The question is being played: keys wait. */
  const [sounding, setSounding] = useState(false);
  const startedAt = useRef(0);
  const question = questions[index];
  const finished = question === undefined;
  const result = quizResult(firstTry, questions.length);
  // The microphone hears one note at a time: chords are answered by choosing. Scales always are.
  const chordByKeys =
    question?.quality !== null && question?.level !== EarLevel.Scales && !usingMic;

  /** A rhythm's taps so far (ms). */
  const taps = useRef<number[]>([]);
  const soundTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The reference can be turned off, even halfway through.
  const withReference = useRef(reference);
  useEffect(() => {
    withReference.current = reference;
  }, [reference]);
  const play = async (next: EarQuestion) => {
    const asked = withReference.current ? next : { ...next, reference: null };
    const engine = await startAudio().catch((error: unknown) => {
      console.warn('No audio', error);
      return null;
    });
    if (!engine) return;
    engine.stopAccompaniment();
    taps.current = [];
    const start = performance.now() + START_DELAY_MS + soundLeadMs();
    for (const note of promptNotes(asked)) {
      engine.accompany(note.midi, start + note.at, start + note.at + note.length);
    }
    const end = start + promptLength(asked);
    ignoreMicUntil(end + engine.outputDelayMs() + RING_MS);
    setSounding(true);
    clearTimeout(soundTimer.current);
    soundTimer.current = setTimeout(() => setSounding(false), end - performance.now());
  };
  useEffect(
    () => () => {
      clearTimeout(soundTimer.current);
      audioIfReady()?.stopAccompaniment();
    },
    [],
  );

  // Answers: keys pressed once the question has been heard.
  const latest = useRef({ question, played, answered, sounding, started, chordByKeys });
  useEffect(() => {
    latest.current = { question, played, answered, sounding, started, chordByKeys };
  });
  const miss = (pitch: number | null) => {
    setMisses((n) => n + 1);
    setWrongKey(pitch);
  };
  const right = (missed: number) => {
    setAnswered(true);
    setWrongKey(null);
    setAnswers((previous) => [...previous, missed === 0]);
  };
  const latestMisses = useRef(misses);
  useEffect(() => {
    latestMisses.current = misses;
  });
  useEffect(() => {
    const held = new Set<number>();
    /** A wrong chord was judged: wait until its keys are up before judging again. */
    let judged = false;
    return subscribeNotes((event) => {
      const current = latest.current;
      if (event.type === NoteEventType.Off) {
        held.delete(event.pitch);
        if (held.size === 0) judged = false;
        return;
      }
      held.add(event.pitch);
      const asked = current.question;
      if (!asked || !current.started || current.answered || current.sounding) return;
      if (asked.rhythm) {
        // Any key is a tap; a long pause starts over.
        const last = taps.current.at(-1);
        if (last !== undefined && event.time - last > TAPS_FORGOTTEN_MS) taps.current = [];
        taps.current.push(event.time);
        setPlayed(taps.current.length);
        if (taps.current.length < asked.notes.length) return;
        const answer = answerRhythm(asked, taps.current);
        taps.current = [];
        if (answer === Answer.Right) right(latestMisses.current);
        else {
          setPlayed(0);
          miss(null);
        }
        return;
      }
      if (asked.quality !== null) {
        if (!current.chordByKeys || judged) return;
        const answer = answerChord(asked, [...held]);
        if (answer === Answer.Right) right(latestMisses.current);
        else if (answer === Answer.Wrong) {
          judged = true;
          miss(null);
        }
        return;
      }
      const answer = answerNote(asked, current.played, event.pitch, event.source);
      if (answer === Answer.Wrong) miss(event.pitch);
      else {
        setWrongKey(null);
        setPlayed(current.played + 1);
        if (answer === Answer.Right) right(latestMisses.current);
      }
    });
  }, []);

  // A right answer moves on to the next question, which plays by itself.
  useEffect(() => {
    if (!answered) return;
    const timer = setTimeout(() => {
      const next = questions[index + 1];
      setIndex((i) => i + 1);
      setAnswered(false);
      setPlayed(0);
      setMisses(0);
      if (next) void play(next);
    }, NEXT_QUESTION_MS);
    return () => clearTimeout(timer);
  }, [answered, index, questions]);

  const reported = useRef(false);
  const finishedRef = useRef(onFinish);
  useEffect(() => {
    finishedRef.current = onFinish;
  });
  useEffect(() => {
    if (!finished || !started || reported.current) return;
    reported.current = true;
    finishedRef.current?.(result, performance.now() - startedAt.current);
  }, [finished, started, result]);

  // Practice time, while questions are being answered.
  useEffect(() => {
    if (!started || finished) return;
    const timer = activityTimer();
    const unsubscribe = subscribeNotes(timer.activity);
    return () => {
      unsubscribe();
      void recordPracticeTime(timer.stop());
    };
  }, [started, finished]);

  const begin = (fresh: EarQuestion[]) => {
    reported.current = false;
    startedAt.current = performance.now();
    setQuestions(fresh);
    setIndex(0);
    setPlayed(0);
    setMisses(0);
    setWrongKey(null);
    setAnswered(false);
    setAnswers([]);
    setStarted(true);
    if (fresh[0]) void play(fresh[0]);
  };

  const keysShown = useSettings((s) => s.keysShown);
  const layout = useMemo(
    () =>
      keyboardLayout(
        ...keyboardRange(
          questions.flatMap((q) => [...q.notes, ...(q.reference ? [q.reference] : [])]),
          keysShown,
        ),
      ),
    [questions, keysShown],
  );
  const pressed = usePressedKeys();
  const held = useLiveInput((s) => s.held);
  const marks = useMemo(() => {
    if (!question || !started) return new Map<number, KeyMark>();
    const fits = (pitch: number) =>
      question.rhythm !== null ||
      (question.quality !== null
        ? question.notes.some((note) => pitchClass(note) === pitchClass(pitch))
        : question.notes.includes(pitch));
    return new Map<number, KeyMark>(
      held.map((note) => [note.pitch, fits(note.pitch) ? KeyMark.Correct : KeyMark.Wrong]),
    );
  }, [held, question, started]);
  const showAnswer = question && started && (answered || misses >= HINT_AFTER);
  const expected = useMemo(() => {
    const keys = new Map<number, ExpectedKey>();
    if (!question || !started) return keys;
    if (showAnswer) {
      const shown = question.quality !== null ? question.notes : [hintKey(question, played)];
      for (const key of shown)
        if (key !== null && key !== undefined) keys.set(key, { hand: Hand.Right });
    } else if (question.given !== null && played === 0) {
      keys.set(question.given, { hand: Hand.Right });
    }
    return keys;
  }, [question, started, showAnswer, played]);

  if (finished) {
    return (
      <section className="results quiz__results" aria-labelledby="ear-results">
        <h2 id="ear-results">{t('earTraining.results')}</h2>
        <QuizTally marks={answers} total={questions.length} current={null} />
        <Stars stars={result.stars} />
        <p className="results__accuracy">
          <span className="muted">{t('practice.results.accuracy')}</span>
          <strong>{formatPercent(result.accuracy, i18n.language)}</strong>
        </p>
        <p>{t('earTraining.firstTry', { count: result.firstTry, total: result.total })}</p>
        <div className="button-row results__actions">
          <ShortcutButton
            shortcut={ShortcutKey.Space}
            className="button button--primary"
            title={t('earTraining.againTip')}
            onClick={() => begin(newQuestions())}
          >
            {t('practice.results.retry')}
          </ShortcutButton>
        </div>
      </section>
    );
  }

  const name = (midi: number) => names.name(pitchFromMidi(midi), { octave: false });
  const rightMessage = () => {
    if (question.quality !== null) {
      const chord = tt(`chords.${question.quality}`, { root: name(question.notes[0]!) });
      return level === EarLevel.Scales
        ? t('earTraining.right.scale', { scale: chord })
        : t('earTraining.right.chord', { chord });
    }
    if (level === EarLevel.Intervals) {
      const interval = identifyInterval([...question.notes]);
      const down = question.notes[1]! < question.notes[0]!;
      return t(down ? 'earTraining.right.intervalDown' : 'earTraining.right.interval', {
        from: name(question.notes[0]!),
        to: name(question.notes[1]!),
        interval: interval ? tt(`intervals.${interval}`) : '',
      });
    }
    if (level === EarLevel.Notes)
      return t('earTraining.right.note', { note: name(question.notes[0]!) });
    if (level === EarLevel.Rhythms) return t('earTraining.right.rhythm');
    return t('earTraining.right.melody');
  };
  const message = !started
    ? level === EarLevel.Notes && !reference
      ? t('earTraining.start.notesAlone')
      : t(`earTraining.start.${level}`, { c: name(MIDDLE_C) })
    : sounding
      ? t('earTraining.listen')
      : answered
        ? rightMessage()
        : misses > 0
          ? [
              wrongKey !== null
                ? t('earTraining.wrong', { note: name(wrongKey) })
                : question.rhythm
                  ? t('earTraining.wrongRhythm')
                  : t('earTraining.wrongChord'),
              misses < HINT_AFTER
                ? ''
                : question.rhythm
                  ? t('earTraining.hintRhythm', { count: question.notes.length })
                  : t('earTraining.hint'),
            ]
              .filter(Boolean)
              .join(' ')
          : level === EarLevel.Scales
            ? t('earTraining.ask.scales')
            : question.quality !== null && !chordByKeys
              ? t('earTraining.ask.chordsMic')
              : level === EarLevel.Notes && !reference
                ? t('earTraining.ask.notesAlone')
                : t(`earTraining.ask.${level}`, { c: name(MIDDLE_C) });

  return (
    <div className="quiz ear">
      {/* How it's going, once it's started. */}
      {started && <QuizTally marks={answers} total={questions.length} current={index} />}
      <div className="ear__controls">
        {started ? (
          <ShortcutButton
            shortcut={ShortcutKey.Space}
            className="button"
            disabled={sounding}
            title={t('earTraining.againTip')}
            onClick={() => void play(question)}
          >
            <span className="button__icon" aria-hidden="true">
              {ICONS.volume}
            </span>
            {t('earTraining.hearAgain')}
          </ShortcutButton>
        ) : (
          <ShortcutButton
            shortcut={ShortcutKey.Enter}
            className="button button--primary button--big"
            onClick={() => begin(questions)}
          >
            <span className="button__icon" aria-hidden="true">
              {ICONS.listen}
            </span>
            {t('earTraining.begin')}
          </ShortcutButton>
        )}
        {started && question.quality !== null && (
          <div className="button-row" role="group" aria-label={t('earTraining.chooseLabel')}>
            {CHORD_KINDS.map((quality) => (
              <button
                key={quality}
                type="button"
                className="button"
                disabled={sounding || answered}
                onClick={() =>
                  answerQuality(question, quality) === Answer.Right ? right(misses) : miss(null)
                }
              >
                {t(`earTraining.quality.${quality}`)}
              </button>
            ))}
          </div>
        )}
      </div>
      <p
        className={
          answered
            ? 'notice notice--ok quiz__message'
            : started && misses > 0
              ? 'notice notice--problem quiz__message'
              : 'quiz__message'
        }
        role="status"
      >
        {message}
      </p>
      <PianoKeyboard
        layout={layout}
        pressed={pressed}
        expected={expected}
        marks={marks}
        labels={KeyLabels.White}
        labelFor={(midi) => names.name(pitchFromMidi(midi), { octave: false })}
        onKeyDown={screenKeyDown}
        onKeyUp={screenKeyUp}
      />
    </div>
  );
}
