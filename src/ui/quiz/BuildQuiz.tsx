/**
 * Finding a note from an interval, on the keyboard (PLAN.md milestone 7.1): the note it starts
 * from is marked and played, the answer isn't, and any octave counts. Wrong keys say which note
 * they were; after two misses the answer lights up. Scored by those right the first time.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { resolvePlayed } from '../../engine/micAliases';
import { quizResult, type QuizResult } from '../../engine/quiz';
import { Hand } from '../../engine/score';
import { KeyMark } from '../../engine/session';
import {
  buildCards,
  type IntervalCard,
  type IntervalSet,
  keysFor,
} from '../../engine/theoryQuestions';
import { useNoteNames } from '../../i18n/useNoteNames';
import { subscribeNotes } from '../../input/bus';
import { useLiveInput } from '../../input/liveStore';
import { type InputSource, NoteEventType } from '../../input/types';
import { activityTimer, recordPracticeTime } from '../../storage/progress';
import { pitchClass, pitchFromMidi, type Pitch } from '../../theory/pitch';
import type { ExpectedKey } from '../keyboard/PianoKeyboard';
import { StepKeyboard } from '../screens/lesson/steps/StepKeyboard';
import { playNotes, stopNotes, useAnswerNames } from './intervalQuiz';
import { QuizResults } from './QuizResults';
import { QuizTally } from './QuizTally';

/** Pause on a right answer before the next card. */
const NEXT_CARD_MS = 900;
/** Misses before the answer is shown. */
const HINT_AFTER = 2;

/** The key is the answer, in any octave (the note given doesn't count as an octave above it). */
function isAnswer(card: IntervalCard, pitch: number, source: InputSource): boolean {
  const played = resolvePlayed(pitch, source, [card.top.midi]);
  return pitchClass(played) === pitchClass(card.top.midi) && played !== card.root.midi;
}

interface BuildQuizProps {
  questions: IntervalSet;
  count: number;
  /** Called when the last card is answered. */
  onFinish?: (result: QuizResult) => void;
  /** Extra buttons next to Try again (e.g. Continue in a lesson). */
  actions?: (result: QuizResult) => ReactNode;
}

export function BuildQuiz({ questions, count, onFinish, actions }: BuildQuizProps) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const answers = useAnswerNames();
  // Dealt once; Try again deals new ones.
  const [cards, setCards] = useState(() => buildCards(questions, count));
  const [index, setIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  /** Each card answered: right the first time, or not. */
  const [marks, setMarks] = useState<boolean[]>([]);
  const card = cards[index];
  const finished = card === undefined;
  const result = quizResult(marks.filter(Boolean).length, cards.length);

  useEffect(() => {
    if (card) void playNotes([card.root.midi]);
  }, [card]);
  useEffect(() => stopNotes, []);

  // Answers: each key down, but the note given, which is there to be tried.
  const latest = useRef({ card, answered, misses });
  useEffect(() => {
    latest.current = { card, answered, misses };
  });
  useEffect(
    () =>
      subscribeNotes((event) => {
        const { card: current, answered: done, misses: missed } = latest.current;
        if (event.type !== NoteEventType.On || !current || done) return;
        if (event.pitch === current.root.midi) return;
        if (isAnswer(current, event.pitch, event.source)) {
          setAnswered(true);
          setWrongKey(null);
          setMarks((previous) => [...previous, missed === 0]);
        } else {
          setMisses((n) => n + 1);
          setWrongKey(event.pitch);
        }
      }),
    [],
  );

  // A right answer moves on to the next card after a moment.
  useEffect(() => {
    if (!answered) return;
    const timer = setTimeout(() => {
      setIndex((i) => i + 1);
      setAnswered(false);
      setMisses(0);
    }, NEXT_CARD_MS);
    return () => clearTimeout(timer);
  }, [answered]);

  const reported = useRef(false);
  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    onFinish?.(result);
  }, [finished, onFinish, result]);

  // Practice time, while cards are being answered.
  useEffect(() => {
    if (finished) return;
    const timer = activityTimer();
    const unsubscribe = subscribeNotes(timer.activity);
    return () => {
      unsubscribe();
      void recordPracticeTime(timer.stop());
    };
  }, [finished]);

  const restart = () => {
    reported.current = false;
    setCards(buildCards(questions, count));
    setIndex(0);
    setMisses(0);
    setWrongKey(null);
    setAnswered(false);
    setMarks([]);
  };

  const keys = useMemo(() => keysFor(cards), [cards]);
  const highlight = useMemo(
    () => new Map<number, ExpectedKey>(card ? [[card.root.midi, { hand: Hand.Right }]] : []),
    [card],
  );
  const showAnswer = card && (answered || misses >= HINT_AFTER);
  const completed = useMemo(
    () => new Set<number>(showAnswer ? [card.top.midi] : []),
    [showAnswer, card],
  );
  const held = useLiveInput((s) => s.held);
  const keyMarks = useMemo(
    () =>
      new Map<number, KeyMark>(
        card
          ? held
              .filter((note) => note.pitch !== card.root.midi)
              .map((note) => [
                note.pitch,
                isAnswer(card, note.pitch, note.source) ? KeyMark.Correct : KeyMark.Wrong,
              ])
          : [],
      ),
    [held, card],
  );

  if (finished) return <QuizResults result={result} onRetry={restart} actions={actions} />;

  const name = (pitch: Pitch) => names.name(pitch, { octave: false });
  const message = answered
    ? t('quiz.right', { note: name(card.top) })
    : wrongKey !== null
      ? [
          t('quiz.wrong', { note: name(pitchFromMidi(wrongKey)) }),
          misses >= HINT_AFTER ? t('quiz.hint') : '',
        ]
          .filter(Boolean)
          .join(' ')
      : t('lesson.build.anyOctave');

  return (
    <div className="question">
      <QuizTally marks={marks} total={cards.length} current={index} />
      <p className="question__prompt">
        {t('lesson.build.playPrompt', {
          what: answers.phrase(card.answer),
          note: name(card.root),
        })}
      </p>
      <StepKeyboard range={keys} highlight={highlight} completed={completed} marks={keyMarks} />
      <p
        className={answered ? 'notice notice--ok' : wrongKey !== null ? 'notice' : 'muted'}
        role="status"
      >
        {message}
      </p>
    </div>
  );
}
