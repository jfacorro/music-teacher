/**
 * Ear training answered by singing (PLAN.md milestone 6.4): each question is played, then sung
 * back, one note after another, in any octave (`engine/singBack.ts`). A note held in tune is
 * found; another note held steadily is a wrong answer, which says which note it was. After two,
 * the note to sing lights up on the keyboard. Skip moves on without it. Scored by the questions
 * sung back without a miss, as on the keyboard.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { audioIfReady, soundLeadMs, startAudio } from '../../../audio/audio';
import {
  EarLevel,
  type EarQuestion,
  promptLength,
  promptNotes,
} from '../../../content/earTraining';
import type { VoiceEarLevel } from '../../../content/voiceEar';
import { quizResult, type QuizResult } from '../../../engine/quiz';
import { Hand } from '../../../engine/score';
import { SingBack } from '../../../engine/singBack';
import { exactPitch } from '../../../engine/tuner';
import { formatPercent } from '../../../i18n/format';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { ignoreMicUntil, useMic } from '../../../input/mic/micInput';
import { activityTimer, recordPracticeTime } from '../../../storage/progress';
import { useSettings } from '../../../storage/settings';
import { identifyInterval } from '../../../theory/chords';
import { pitchFromMidi } from '../../../theory/pitch';
import { Stars } from '../../components/Stars';
import { ICONS } from '../../icons';
import { keyboardLayout, keyboardRange } from '../../keyboard/layout';
import { type ExpectedKey, PianoKeyboard } from '../../keyboard/PianoKeyboard';
import { KeyLabels } from '../../keyboard/styles';
import { ShortcutButton } from '../../components/ShortcutButton';
import { ShortcutKey } from '../../shortcuts';

/** Pause on a right answer (or a skipped one) before the next question. */
const NEXT_QUESTION_MS = 1600;
/** Misses before the note to sing is shown. */
const HINT_AFTER = 2;
/** The first sound starts this long after asking, so it's never cut (ms). */
const START_DELAY_MS = 150;
/** How long the app's piano keeps ringing for the microphone after a question (ms). */
const RING_MS = 600;

interface SingBackExerciseProps {
  level: EarLevel;
  /** A new exercise's questions. */
  makeQuestions: () => EarQuestion[];
  /** Called when the last question is answered, with how long it took (ms). */
  onFinish?: (result: QuizResult, durationMs: number) => void;
}

export function SingBackExercise({ level, makeQuestions, onFinish }: SingBackExerciseProps) {
  const { t, i18n } = useTranslation('screens');
  const { t: tt } = useTranslation('theory');
  const names = useNoteNames();

  const [questions, setQuestions] = useState(makeQuestions);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  /** Notes sung back so far. */
  const [sung, setSung] = useState(0);
  const [held, setHeld] = useState(0);
  /** The note being sung now, in the octave nearest the one due, or null. */
  const [singing, setSinging] = useState<number | null>(null);
  const [misses, setMisses] = useState(0);
  const [wrongNote, setWrongNote] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  /** The question is being played: the microphone waits. */
  const [sounding, setSounding] = useState(false);
  const startedAt = useRef(0);
  const back = useRef<SingBack | null>(null);
  const listenFrom = useRef(Infinity);
  const question = questions[index];
  const finished = question === undefined;
  const result = quizResult(firstTry, questions.length);

  const soundTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const play = async (next: EarQuestion) => {
    listenFrom.current = Infinity;
    const engine = await startAudio().catch((error: unknown) => {
      console.warn('No audio', error);
      return null;
    });
    if (!engine) {
      listenFrom.current = performance.now();
      return;
    }
    engine.stopAccompaniment();
    const start = performance.now() + START_DELAY_MS + soundLeadMs();
    for (const note of promptNotes(next)) {
      engine.accompany(note.midi, start + note.at, start + note.at + note.length);
    }
    const until = start + promptLength(next) + engine.outputDelayMs() + RING_MS;
    ignoreMicUntil(until);
    listenFrom.current = until;
    setSounding(true);
    setSinging(null);
    clearTimeout(soundTimer.current);
    soundTimer.current = setTimeout(() => setSounding(false), until - performance.now());
  };
  useEffect(
    () => () => {
      clearTimeout(soundTimer.current);
      audioIfReady()?.stopAccompaniment();
    },
    [],
  );

  const ask = (next: EarQuestion) => {
    back.current = new SingBack(next.notes);
    setSung(0);
    setHeld(0);
    setMisses(0);
    setWrongNote(null);
    setAnswered(false);
    setSkipped(false);
    void play(next);
  };

  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });

  // The singing, once the question has been heard.
  const missesRef = useRef(misses);
  useEffect(() => {
    missesRef.current = misses;
  });
  useEffect(() => {
    if (!started || finished) return;
    const timer = activityTimer();
    const unsubscribe = useMic.subscribe(({ reading }) => {
      const now = performance.now();
      const current = back.current;
      if (!current || current.finished || now < listenFrom.current) return;
      const pitch = reading ? exactPitch(reading) : null;
      if (pitch !== null) timer.activity();
      const due = current.current!;
      const nearest = pitch === null ? null : Math.round(pitch);
      setSinging(nearest === null ? null : nearest + 12 * Math.round((due - nearest) / 12));
      const update = current.update(pitch, now);
      setHeld(update.held);
      if (update.wrong !== null) {
        setMisses((n) => n + 1);
        setWrongNote(update.wrong);
      }
      if (update.found !== null) {
        setSung(current.sung);
        setWrongNote(null);
        if (current.finished) {
          setAnswered(true);
          if (missesRef.current === 0) setFirstTry((n) => n + 1);
        }
      }
    });
    return () => {
      unsubscribe();
      void recordPracticeTime(timer.stop());
    };
  }, [started, finished]);

  // A right (or skipped) answer moves on to the next question, which plays by itself.
  useEffect(() => {
    if (!answered) return;
    const timer = setTimeout(() => {
      const next = questions[index + 1];
      setIndex((i) => i + 1);
      if (next) askRef.current(next);
      else back.current = null;
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

  const begin = (fresh: EarQuestion[]) => {
    reported.current = false;
    startedAt.current = performance.now();
    setQuestions(fresh);
    setIndex(0);
    setFirstTry(0);
    setStarted(true);
    if (fresh[0]) ask(fresh[0]);
  };

  const skip = () => {
    back.current = null;
    setSkipped(true);
    setAnswered(true);
  };

  const keysShown = useSettings((s) => s.keysShown);
  const layout = useMemo(
    () =>
      keyboardLayout(
        ...keyboardRange(
          questions.flatMap((q) => q.notes),
          keysShown,
        ),
      ),
    [questions, keysShown],
  );
  const showAnswer = question && started && (skipped || misses >= HINT_AFTER);
  const expected = useMemo(() => {
    const keys = new Map<number, ExpectedKey>();
    if (!question || !started) return keys;
    const shown = skipped
      ? question.notes
      : showAnswer
        ? [question.notes[sung]]
        : sung === 0 && question.given !== null
          ? [question.given]
          : [];
    for (const key of shown) if (key !== undefined) keys.set(key, { hand: Hand.Right });
    return keys;
  }, [question, started, skipped, showAnswer, sung]);
  const completed = useMemo(
    () => new Set(question && started ? question.notes.slice(0, sung) : []),
    [question, started, sung],
  );
  const pressed = useMemo(
    () => new Set(singing !== null && !answered && !sounding ? [singing] : []),
    [singing, answered, sounding],
  );

  if (finished) {
    return (
      <section className="results quiz__results" aria-labelledby="ear-results">
        <h2 id="ear-results">{t('earTraining.results')}</h2>
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
            onClick={() => begin(makeQuestions())}
          >
            {t('practice.results.retry')}
          </ShortcutButton>
        </div>
      </section>
    );
  }

  const name = (midi: number) => names.name(pitchFromMidi(midi), { octave: false });
  const rightMessage = () => {
    if (level === EarLevel.Intervals) {
      const [from, to] = question.notes as [number, number];
      const interval = identifyInterval([from, to]);
      return t(to > from ? 'earTraining.right.interval' : 'earTraining.right.intervalDown', {
        from: name(from),
        to: name(to),
        interval: interval ? tt(`intervals.${interval}`) : '',
      });
    }
    if (level === EarLevel.Notes)
      return t('earTraining.right.note', { note: name(question.notes[0]!) });
    return t('earTraining.right.melody');
  };
  const message = !started
    ? t(`earTraining.sing.start.${level as VoiceEarLevel}`)
    : sounding
      ? t('earTraining.listen')
      : skipped
        ? t('earTraining.sing.skipped', {
            notes: question.notes.map(name).join(', '),
          })
        : answered
          ? rightMessage()
          : wrongNote !== null
            ? [
                t('earTraining.sing.wrong', { note: name(wrongNote) }),
                misses >= HINT_AFTER ? t('earTraining.sing.hint') : '',
              ]
                .filter(Boolean)
                .join(' ')
            : misses >= HINT_AFTER
              ? t('earTraining.sing.hint')
              : sung > 0
                ? t('earTraining.sing.next')
                : t(`earTraining.sing.ask.${level as VoiceEarLevel}`);

  return (
    <div className="quiz ear">
      <p className="muted quiz__progress">
        {t('earTraining.progress', { current: index + 1, total: questions.length })}
      </p>
      <div className="ear__controls">
        {started ? (
          <>
            <button
              type="button"
              className="button"
              disabled={sounding || answered}
              title={t('earTraining.againTip')}
              onClick={() => void play(question)}
            >
              <span className="button__icon" aria-hidden="true">
                {ICONS.volume}
              </span>
              {t('earTraining.hearAgain')}
            </button>
            <button
              type="button"
              className="button"
              disabled={sounding || answered}
              title={t('earTraining.sing.skipTip')}
              onClick={skip}
            >
              {t('earTraining.sing.skip')}
            </button>
          </>
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
      </div>
      {started && (
        <div className="sing-back" aria-label={t('earTraining.sing.notesLabel')}>
          <ol className="sing-back__notes">
            {question.notes.map((note, i) => {
              const known = i < sung || skipped || (i === 0 && question.given !== null);
              return (
                <li
                  key={i}
                  className={
                    i < sung
                      ? 'sing-back__note sing-back__note--done'
                      : i === sung && !answered && !sounding
                        ? 'sing-back__note sing-back__note--now'
                        : 'sing-back__note'
                  }
                >
                  {known ? name(note) : '?'}
                </li>
              );
            })}
          </ol>
          <span className="hold-bar" aria-hidden="true">
            <span style={{ inlineSize: `${Math.round((answered ? 0 : held) * 100)}%` }} />
          </span>
        </div>
      )}
      <p
        className={
          answered && !skipped
            ? 'notice notice--ok quiz__message'
            : started && (wrongNote !== null || skipped)
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
        completed={completed}
        labels={KeyLabels.White}
        labelFor={name}
      />
    </div>
  );
}
