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

/**
 * Which of `notes` the key is, in any octave. Asked for one note, the note given doesn't count as
 * an octave above it; in a melody, it can be one of the notes.
 */
function matching(
  card: TheoryCard,
  notes: readonly Pitch[],
  pitch: number,
  source: InputSource,
): Pitch | undefined {
  const played = resolvePlayed(
    pitch,
    source,
    notes.map((note) => note.midi),
  );
  if (card.targets.length === 1 && played === card.given?.midi) return undefined;
  return notes.find((note) => pitchClass(note.midi) === pitchClass(played));
}

/** The notes still to find, of those not in `found`: the next one, or any if there's no order. */
const wanted = (card: TheoryCard, found: readonly Pitch[]): readonly Pitch[] => {
  const left = card.targets.filter((note) => !found.includes(note));
  return card.ordered ? left.slice(0, 1) : left;
};

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
  /** The card's notes found so far. */
  const [found, setFound] = useState<readonly Pitch[]>([]);
  const [misses, setMisses] = useState(0);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  /** Each card answered: with no misses, or not. */
  const [marks, setMarks] = useState<boolean[]>([]);
  const card = cards[index];
  const finished = card === undefined;
  const result = quizResult(marks.filter(Boolean).length, cards.length);

  useEffect(() => {
    if (card?.given) void playSound([[card.given]]);
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
        const note = matching(current, wanted(current, got), event.pitch, event.source);
        if (note) {
          const now = [...got, note];
          const complete = now.length === current.targets.length;
          latest.current = { ...latest.current, found: now, answered: complete };
          setFound(now);
          setWrongKey(null);
          if (complete) {
            setAnswered(true);
            setMarks((previous) => [...previous, missed === 0]);
          }
        } else if (
          event.pitch !== current.given?.midi &&
          !matching(current, got, event.pitch, event.source)
        ) {
          // Trying the note given, or playing again one already found, isn't a miss.
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
      setFound([]);
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
    setFound([]);
    setMisses(0);
    setWrongKey(null);
    setAnswered(false);
    setMarks([]);
  };

  const keys = useMemo(() => keysFor(cards), [cards]);
  const highlight = useMemo(
    () =>
      new Map<number, ExpectedKey>(card?.given ? [[card.given.midi, { hand: Hand.Right }]] : []),
    [card],
  );
  const showNext = misses >= HINT_AFTER;
  const completed = useMemo(
    () =>
      new Set<number>(
        card
          ? [...found, ...(showNext ? wanted(card, found).slice(0, 1) : [])].map(
              (note) => note.midi,
            )
          : [],
      ),
    [showNext, found, card],
  );
  const held = useLiveInput((s) => s.held);
  const keyMarks = useMemo(
    () =>
      new Map<number, KeyMark>(
        card
          ? held
              .filter((note) => note.pitch !== card.given?.midi)
              .map((note) => [
                note.pitch,
                matching(card, [...found, ...wanted(card, found)], note.pitch, note.source)
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
      : found.length > 0
        ? t('lesson.build.found', { found: found.length, total })
        : t(card.ordered ? 'lesson.build.anyOctave' : 'lesson.build.anyOrder');

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
