/**
 * Note-naming quiz (PLAN.md §2.5): a note on the staff, the learner plays its key. Wrong keys
 * say which note they were; after two misses the right key lights up. Scored by the cards
 * answered right on the first try.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { QuizClef } from '../../content/lessons';
import { resolvePlayed } from '../../engine/micAliases';
import { quizCards, quizResult, type QuizResult } from '../../engine/quiz';
import { KeyMark } from '../../engine/session';
import { formatPercent } from '../../i18n/format';
import { useNoteNames } from '../../i18n/useNoteNames';
import { subscribeNotes } from '../../input/bus';
import { screenKeyDown, screenKeyUp } from '../../input/dev/screenInput';
import { useLiveInput } from '../../input/liveStore';
import { activityTimer, recordPracticeTime } from '../../storage/progress';
import { MIDDLE_C, pitchFromMidi, type Pitch } from '../../theory/pitch';
import { Stars } from '../components/Stars';
import { usePressedKeys } from '../hooks';
import { keyboardLayout, rangeForNotes } from '../keyboard/layout';
import { PianoKeyboard, type ExpectedKey } from '../keyboard/PianoKeyboard';
import { KeyLabels } from '../keyboard/styles';
import { NoteCard } from '../sheet/NoteCard';
import { Hand } from '../../engine/score';
import { NoteEventType } from '../../input/types';
import { Clef } from '../../content/musicxml';

/** Pause on a right answer before the next card. */
const NEXT_CARD_MS = 900;
/** Misses before the right key is shown. */
const HINT_AFTER = 2;

const clefFor = (pitch: Pitch, clef: QuizClef): Clef =>
  clef === QuizClef.Auto ? (pitch.midi >= MIDDLE_C ? Clef.Treble : Clef.Bass) : clef;

interface NoteQuizProps {
  notes: readonly Pitch[];
  count: number;
  clef: QuizClef;
  /** Called when the last card is answered. */
  onFinish?: (result: QuizResult) => void;
  /** Extra buttons next to Try again (e.g. Continue in a lesson). */
  actions?: (result: QuizResult) => ReactNode;
}

export function NoteQuiz({ notes, count, clef, onFinish, actions }: NoteQuizProps) {
  const { t, i18n } = useTranslation('screens');
  const names = useNoteNames();
  // Dealt once; Try again deals new ones. (A new set of notes needs a new key.)
  const [cards, setCards] = useState(() => quizCards(notes, count));
  const [index, setIndex] = useState(0);
  const [misses, setMisses] = useState(0);
  const [wrongKey, setWrongKey] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const card = cards[index];
  const finished = card === undefined;
  const result = quizResult(firstTry, cards.length);

  // Answers: the first key down after the card appears (and after each miss).
  const latest = useRef({ card, answered, misses });
  useEffect(() => {
    latest.current = { card, answered, misses };
  });
  useEffect(
    () =>
      subscribeNotes((event) => {
        const { card: current, answered: done, misses: missed } = latest.current;
        if (event.type !== NoteEventType.On || !current || done) return;
        if (resolvePlayed(event.pitch, event.source, [current.midi]) === current.midi) {
          setAnswered(true);
          setWrongKey(null);
          if (missed === 0) setFirstTry((n) => n + 1);
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
    setCards(quizCards(notes, count));
    setIndex(0);
    setMisses(0);
    setWrongKey(null);
    setAnswered(false);
    setFirstTry(0);
  };

  const layout = useMemo(
    () => keyboardLayout(...rangeForNotes(notes.map((note) => note.midi))),
    [notes],
  );
  const pressed = usePressedKeys();
  const held = useLiveInput((s) => s.held);
  const marks = useMemo(
    () =>
      new Map<number, KeyMark>(
        card
          ? held.map((note) => [
              note.pitch,
              resolvePlayed(note.pitch, note.source, [card.midi]) === card.midi
                ? KeyMark.Correct
                : KeyMark.Wrong,
            ])
          : [],
      ),
    [held, card],
  );
  const showKey = card && (answered || misses >= HINT_AFTER);
  const expected = useMemo(
    () => new Map<number, ExpectedKey>(showKey ? [[card.midi, { hand: Hand.Right }]] : []),
    [showKey, card],
  );

  if (finished) {
    return (
      <section className="results quiz__results" aria-labelledby="quiz-results">
        <h2 id="quiz-results">{t('quiz.results')}</h2>
        <Stars stars={result.stars} />
        <p className="results__accuracy">
          <span className="muted">{t('practice.results.accuracy')}</span>
          <strong>{formatPercent(result.accuracy, i18n.language)}</strong>
        </p>
        <p>{t('quiz.firstTry', { count: result.firstTry, total: result.total })}</p>
        <div className="button-row results__actions">
          <button
            type="button"
            className={actions ? 'button' : 'button button--primary'}
            title={t('quiz.newCards')}
            onClick={restart}
          >
            {t('practice.results.retry')}
          </button>
          {actions?.(result)}
        </div>
      </section>
    );
  }

  // With the octave: here F4 and F5 are different answers.
  const name = (pitch: Pitch) => names.name(pitch, { octave: true });
  const message = answered
    ? t('quiz.right', { note: name(card) })
    : wrongKey !== null
      ? [
          t('quiz.wrong', { note: name(pitchFromMidi(wrongKey)) }),
          misses >= HINT_AFTER ? t('quiz.hint') : '',
        ]
          .filter(Boolean)
          .join(' ')
      : t('quiz.prompt');

  return (
    <div className="quiz">
      <p className="muted quiz__progress">
        {t('quiz.progress', { current: index + 1, total: cards.length })}
      </p>
      <NoteCard pitch={card} clef={clefFor(card, clef)} />
      <p
        className={
          answered
            ? 'notice notice--ok quiz__message'
            : wrongKey !== null
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
        labels={KeyLabels.None}
        labelFor={(midi) => names.name(pitchFromMidi(midi), { octave: false })}
        onKeyDown={screenKeyDown}
        onKeyUp={screenKeyUp}
      />
    </div>
  );
}
