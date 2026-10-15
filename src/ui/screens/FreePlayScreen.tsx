import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNoteNames } from '../../i18n/useNoteNames';
import { screenKeyDown, screenKeyUp } from '../../input/dev/screenInput';
import { MIDDLE_C, pitchesOf, pitchFromMidi, type Pitch } from '../../theory/pitch';
import { ChordName } from '../components/ChordName';
import { HeldNotesDisplay } from '../components/HeldNotesDisplay';
import { usePressedKeys } from '../hooks';
import { FULL_PIANO, keyboardLayout } from '../keyboard/layout';
import { PianoKeyboard } from '../keyboard/PianoKeyboard';
import { KeyLabels } from '../keyboard/styles';
import { NoteQuiz } from '../quiz/NoteQuiz';
import { QuizClef } from '../../content/lessons/lesson';

const layout = keyboardLayout(...FULL_PIANO);

const FreePlayMode = {
  Play: 'play',
  Quiz: 'quiz',
} as const;
type FreePlayMode = (typeof FreePlayMode)[keyof typeof FreePlayMode];

const QuizClefs = {
  Treble: 'treble',
  Bass: 'bass',
  Both: 'both',
} as const;
type QuizClefs = (typeof QuizClefs)[keyof typeof QuizClefs];

const MODES: readonly FreePlayMode[] = [FreePlayMode.Play, FreePlayMode.Quiz];
const QUIZ_CLEFS: readonly QuizClefs[] = [QuizClefs.Treble, QuizClefs.Bass, QuizClefs.Both];
const QUIZ_CARDS = 10;

/** The notes read on each staff: the lines and spaces, plus a ledger line or two. */
const TREBLE = pitchesOf('C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5');
const BASS = pitchesOf('G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4');
const QUIZ_NOTES: Readonly<Record<QuizClefs, Pitch[]>> = {
  [QuizClefs.Treble]: TREBLE,
  [QuizClefs.Bass]: BASS,
  // Middle C appears in both: keep it once (on the treble staff).
  [QuizClefs.Both]: [...BASS.filter((note) => note.midi < MIDDLE_C), ...TREBLE],
};

export function FreePlayScreen() {
  const { t } = useTranslation('screens');
  const [mode, setMode] = useState<FreePlayMode>(FreePlayMode.Play);
  const [clefs, setClefs] = useState<QuizClefs>(QuizClefs.Treble);
  const clefId = useId();

  return (
    <section className="screen">
      <h1>{t('freePlay.title')}</h1>
      <div className="practice__options">
        <div className="segmented" role="radiogroup" aria-label={t('freePlay.title')}>
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={mode === value ? 'segmented__option is-selected' : 'segmented__option'}
              title={t(`freePlay.tips.${value}`)}
              onClick={() => setMode(value)}
            >
              {t(`freePlay.modes.${value}`)}
            </button>
          ))}
        </div>
        {mode === FreePlayMode.Quiz && (
          <label className="inline-field" htmlFor={clefId}>
            {t('freePlay.quiz.clef')}
            <select
              id={clefId}
              value={clefs}
              onChange={(e) => setClefs(e.target.value as QuizClefs)}
            >
              {QUIZ_CLEFS.map((value) => (
                <option key={value} value={value}>
                  {t(`freePlay.quiz.${value}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {mode === FreePlayMode.Play ? (
        <FreePlay />
      ) : (
        <>
          <p>{t('freePlay.quiz.intro')}</p>
          {/* New clefs, new cards. */}
          <NoteQuiz key={clefs} notes={QUIZ_NOTES[clefs]} count={QUIZ_CARDS} clef={QuizClef.Auto} />
        </>
      )}
    </section>
  );
}

function FreePlay() {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const pressed = usePressedKeys();
  // Only the Cs are labelled on the full piano, with octave numbers to find your way.
  const label = useCallback(
    (midi: number) => names.name(pitchFromMidi(midi), { octave: true }),
    [names],
  );

  return (
    <>
      <p>{t('freePlay.intro')}</p>
      <HeldNotesDisplay />
      <ChordName />
      <PianoKeyboard
        layout={layout}
        pressed={pressed}
        labels={KeyLabels.C}
        labelFor={label}
        onKeyDown={screenKeyDown}
        onKeyUp={screenKeyUp}
      />
    </>
  );
}
