import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNoteNames } from '../../i18n/useNoteNames';
import { screenKeyDown, screenKeyUp } from '../../input/dev/screenInput';
import { parseNote, pitchFromMidi } from '../../theory/pitch';
import { ChordName } from '../components/ChordName';
import { HeldNotesDisplay } from '../components/HeldNotesDisplay';
import { usePressedKeys } from '../hooks';
import { FULL_PIANO, keyboardLayout } from '../keyboard/layout';
import { PianoKeyboard } from '../keyboard/PianoKeyboard';
import { NoteQuiz } from '../quiz/NoteQuiz';

const layout = keyboardLayout(...FULL_PIANO);

type Mode = 'play' | 'quiz';
type QuizClefs = 'treble' | 'bass' | 'both';
const MODES: readonly Mode[] = ['play', 'quiz'];
const QUIZ_CLEFS: readonly QuizClefs[] = ['treble', 'bass', 'both'];
const QUIZ_CARDS = 10;

/** The notes read on each staff: the lines and spaces, plus a ledger line or two. */
const TREBLE = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'].map(
  parseNote,
);
const BASS = ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'].map(parseNote);
const QUIZ_NOTES: Readonly<Record<QuizClefs, ReturnType<typeof parseNote>[]>> = {
  treble: TREBLE,
  bass: BASS,
  // Middle C appears in both: keep it once (on the treble staff).
  both: [...BASS.filter((note) => note.midi < 60), ...TREBLE],
};

export function FreePlayScreen() {
  const { t } = useTranslation('screens');
  const [mode, setMode] = useState<Mode>('play');
  const [clefs, setClefs] = useState<QuizClefs>('treble');
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
              onClick={() => setMode(value)}
            >
              {t(`freePlay.modes.${value}`)}
            </button>
          ))}
        </div>
        {mode === 'quiz' && (
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

      {mode === 'play' ? (
        <FreePlay />
      ) : (
        <>
          <p>{t('freePlay.quiz.intro')}</p>
          {/* New clefs, new cards. */}
          <NoteQuiz key={clefs} notes={QUIZ_NOTES[clefs]} count={QUIZ_CARDS} clef="auto" />
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
        labels="c"
        labelFor={label}
        onKeyDown={screenKeyDown}
        onKeyUp={screenKeyUp}
      />
    </>
  );
}
