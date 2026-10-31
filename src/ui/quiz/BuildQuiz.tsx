/**
 * Finding notes on the keyboard (PLAN.md milestones 7.1 and 7.3): the note given is marked and
 * played, the answer isn't, and any octave counts. Wrong keys say which note they were; after two
 * misses the next note lights up. Scored by the cards with no misses.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { resolvePlayed } from '../../engine/micAliases';
import { quizResult, type QuizResult } from '../../engine/quiz';
import { Hand } from '../../engine/score';
import { KeyMark } from '../../engine/session';
import {
  buildCards,
  keysFor,
  type QuestionSet,
  type TheoryCard,
} from '../../engine/theoryQuestions';
import { useNoteNames } from '../../i18n/useNoteNames';
import { subscribeNotes } from '../../input/bus';
import { useLiveInput } from '../../input/liveStore';
import { type InputSource, NoteEventType } from '../../input/types';
import { activityTimer, recordPracticeTime } from '../../storage/progress';
import { pitchClass, pitchFromMidi, type Pitch } from '../../theory/pitch';
import type { ExpectedKey } from '../keyboard/PianoKeyboard';
import { StepKeyboard } from '../screens/lesson/steps/StepKeyboard';
import { playSound, stopNotes, useCardWords } from './intervalQuiz';
import { QuizResults } from './QuizResults';
import { QuizTally } from './QuizTally';

/** Pause on a right answer before the next card. */
const NEXT_CARD_MS = 900;
/** Misses before the answer is shown. */
const HINT_AFTER = 2;

/** The key is one of `notes`, in any octave (the note given doesn't count as an octave above it). */
function isAmong(
  card: TheoryCard,
  notes: readonly Pitch[],
  pitch: number,
  source: InputSource,
): boolean {
  const midis = notes.map((note) => note.midi);
  const played = resolvePlayed(pitch, source, midis);
  return midis.some((midi) => pitchClass(midi) === pitchClass(played)) && played !== card.root.midi;
}

interface BuildQuizProps {
  questions: QuestionSet;
  count: number;
  /** Called when the last card is answered. */
  onFinish?: (result: QuizResult) => void;
  /** Extra buttons next to Try again (e.g. Continue in a lesson). */
  actions?: (result: QuizResult) => ReactNode;
}

export function BuildQuiz({ questions, count, onFinish, actions }: BuildQuizProps) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const words = useCardWords(questions);
  // Dealt once; Try again deals new ones.
  const [cards, setCards] = useState(() => buildCards(questions, count));
  const [index, setIndex] = useState(0);
  /** How many of the card's notes have been found. */
  const [found, setFound] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  /** Each card answered: with no misses, or not. */
  const [marks, setMarks] = useState<boolean[]>([]);
  const card = cards[index];
  const finished = card === undefined;
  const result = quizResult(marks.filter(Boolean).length, cards.length);

  useEffect(() => {
    if (card) void playSound([[card.root]]);
  }, [card]);
  useEffect(() => stopNotes, []);

  // Answers: each key down, but the note given, which is there to be tried.
  const latest = useRef({ card, answered, misses, found });
  useEffect(() => {
    latest.current = { card, answered, misses, found };
  });
  useEffect(
    () =>
      subscribeNotes((event) => {
        const { card: current, answered: done, misses: missed, found: got } = latest.current;
        if (event.type !== NoteEventType.On || !current || done) return;
        if (event.pitch === current.root.midi) return;
        const next = current.targets.slice(got, got + 1);
        if (isAmong(current, next, event.pitch, event.source)) {
          const now = got + 1;
          const complete = now === current.targets.length;
          latest.current = { ...latest.current, found: now, answered: complete };
          setFound(now);
          setWrongKey(null);
          if (complete) {
            setAnswered(true);
            setMarks((previous) => [...previous, missed === 0]);
          }
        } else if (!isAmong(current, current.targets.slice(0, got), event.pitch, event.source)) {
          // Playing a note again that's already found isn't a miss.
          latest.current = { ...latest.current, misses: missed + 1 };
          setMisses(missed + 1);
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
      setFound(0);
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
    setFound(0);
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
  const showNext = misses >= HINT_AFTER;
  const completed = useMemo(
    () =>
      new Set<number>(
        card ? card.targets.slice(0, found + (showNext ? 1 : 0)).map((note) => note.midi) : [],
      ),
    [showNext, found, card],
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
                isAmong(card, card.targets.slice(0, found + 1), note.pitch, note.source)
                  ? KeyMark.Correct
                  : KeyMark.Wrong,
              ])
          : [],
      ),
    [held, card, found],
  );

  if (finished) return <QuizResults result={result} onRetry={restart} actions={actions} />;

  const name = (pitch: Pitch) => names.name(pitch, { octave: false });
  const total = card.targets.length;
  const message = answered
    ? total === 1
      ? t('quiz.right', { note: name(card.targets[0]!) })
      : t('lesson.question.right')
    : wrongKey !== null
      ? [
          t('quiz.wrong', { note: name(pitchFromMidi(wrongKey, { keyFifths: card.keyFifths })) }),
          showNext ? t('quiz.hint') : '',
        ]
          .filter(Boolean)
          .join(' ')
      : found > 0
        ? t('lesson.build.found', { found, total })
        : t('lesson.build.anyOctave');

  return (
    <div className="question">
      <QuizTally marks={marks} total={cards.length} current={index} />
      <p className="question__prompt">{words.play(card)}</p>
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
