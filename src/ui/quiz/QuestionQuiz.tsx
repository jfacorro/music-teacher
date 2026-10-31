/**
 * Theory questions (PLAN.md milestones 7.1 and 7.3): notes shown and played or only played, and a
 * choice of answers. A wrong answer can be tried again, but a question counts as right only if
 * the first answer was.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StaffClef } from '../../content/lessons';
import { quizResult, type QuizResult } from '../../engine/quiz';
import { Hand } from '../../engine/score';
import {
  keysFor,
  type QuestionAnswer,
  type QuestionSet,
  QuestionShow,
  theoryQuestions,
} from '../../engine/theoryQuestions';
import { activityTimer, recordPracticeTime } from '../../storage/progress';
import { MIDDLE_C } from '../../theory/pitch';
import { ShortcutButton } from '../components/ShortcutButton';
import { ICONS } from '../icons';
import type { ExpectedKey } from '../keyboard/PianoKeyboard';
import { StepKeyboard } from '../screens/lesson/steps/StepKeyboard';
import { CircleOfFifths } from '../sheet/CircleOfFifths';
import { StaffPicture } from '../sheet/StaffPicture';
import { ShortcutKey } from '../shortcuts';
import { playSound, stopNotes, useCardWords } from './intervalQuiz';
import { QuizResults } from './QuizResults';
import { QuizTally } from './QuizTally';

/** Pause on a right answer before the next question. */
const NEXT_QUESTION_MS = 900;

interface QuestionQuizProps {
  questions: QuestionSet;
  show: QuestionShow;
  count: number;
  /** Called when the last question is answered. */
  onFinish?: (result: QuizResult) => void;
  /** Extra buttons next to Try again (e.g. Continue in a lesson). */
  actions?: (result: QuizResult) => ReactNode;
}

export function QuestionQuiz({ questions, show, count, onFinish, actions }: QuestionQuizProps) {
  const { t } = useTranslation('screens');
  const words = useCardWords(questions);
  // Dealt once; Try again deals new ones.
  const [cards, setCards] = useState(() => theoryQuestions(questions, count));
  const [index, setIndex] = useState(0);
  /** The wrong answers tried on this question. */
  const [wrong, setWrong] = useState<readonly QuestionAnswer[]>([]);
  const [answered, setAnswered] = useState(false);
  /** Each question answered: right the first time, or not. */
  const [marks, setMarks] = useState<boolean[]>([]);
  const card = cards[index];
  const finished = card === undefined;
  const result = quizResult(marks.filter(Boolean).length, cards.length);

  useEffect(() => {
    if (card) void playSound(card.sound);
  }, [card]);
  useEffect(() => stopNotes, []);

  // A right answer moves on to the next question after a moment.
  useEffect(() => {
    if (!answered) return;
    const timer = setTimeout(() => {
      setIndex((i) => i + 1);
      setAnswered(false);
      setWrong([]);
    }, NEXT_QUESTION_MS);
    return () => clearTimeout(timer);
  }, [answered]);

  const reported = useRef(false);
  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    onFinish?.(result);
  }, [finished, onFinish, result]);

  // Practice time, while questions are being answered.
  const activity = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (finished) return;
    const timer = activityTimer();
    activity.current = timer.activity;
    return () => {
      activity.current = null;
      void recordPracticeTime(timer.stop());
    };
  }, [finished]);

  const choose = (answer: QuestionAnswer) => {
    if (!card || answered) return;
    activity.current?.();
    if (answer === card.answer) {
      setAnswered(true);
      setMarks((previous) => [...previous, wrong.length === 0]);
    } else {
      setWrong((previous) => [...previous, answer]);
    }
  };

  const restart = () => {
    reported.current = false;
    setCards(theoryQuestions(questions, count));
    setIndex(0);
    setWrong([]);
    setAnswered(false);
    setMarks([]);
  };

  const keys = useMemo(() => keysFor(cards), [cards]);
  const highlight = useMemo(
    () =>
      new Map<number, ExpectedKey>(card?.shown.map((note) => [note.midi, { hand: Hand.Right }])),
    [card],
  );

  if (finished) return <QuizResults result={result} onRetry={restart} actions={actions} />;

  const choiceClass = (choice: QuestionAnswer) =>
    answered && choice === card.answer
      ? 'question__choice is-right'
      : wrong.includes(choice)
        ? 'question__choice is-wrong'
        : 'question__choice';

  return (
    <div className="question">
      <div className="question__top">
        <QuizTally marks={marks} total={cards.length} current={index} />
        <ShortcutButton
          shortcut={ShortcutKey.Space}
          className="button"
          disabled={answered}
          onClick={() => void playSound(card.sound)}
        >
          <span className="button__icon" aria-hidden="true">
            {ICONS.volume}
          </span>
          {t('earTraining.hearAgain')}
        </ShortcutButton>
      </div>
      <p className="question__prompt">{words.question(card)}</p>
      {show === QuestionShow.Staff && (
        <StaffPicture
          clef={(card.shown[0]?.midi ?? MIDDLE_C) >= MIDDLE_C ? StaffClef.Treble : StaffClef.Bass}
          notes={card.shown}
          names={false}
          keyFifths={card.keyFifths}
        />
      )}
      {show === QuestionShow.Keyboard && <StepKeyboard range={keys} highlight={highlight} />}
      {show === QuestionShow.Circle && <CircleOfFifths marked={card.keyFifths} />}
      <div className="question__choices" role="group" aria-label={t('lesson.question.choices')}>
        {card.choices.map((choice) => (
          <button
            key={choice}
            type="button"
            className={choiceClass(choice)}
            disabled={answered || wrong.includes(choice)}
            onClick={() => choose(choice)}
          >
            {words.label(choice)}
          </button>
        ))}
      </div>
      <p className={answered ? 'notice notice--ok' : 'muted'} role="status">
        {answered
          ? t('lesson.question.right')
          : wrong.length > 0
            ? t('lesson.question.wrong')
            : ' '}
      </p>
    </div>
  );
}
