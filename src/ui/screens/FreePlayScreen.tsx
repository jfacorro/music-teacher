import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNoteNames } from '../../i18n/useNoteNames';
import { screenKeyDown, screenKeyUp } from '../../input/dev/screenInput';
import { pitchFromMidi } from '../../theory/pitch';
import { ChordName } from '../components/ChordName';
import { HeldNotesDisplay } from '../components/HeldNotesDisplay';
import { usePressedKeys } from '../hooks';
import { FULL_PIANO, keyboardLayout } from '../keyboard/layout';
import { PianoKeyboard } from '../keyboard/PianoKeyboard';

const layout = keyboardLayout(...FULL_PIANO);

export function FreePlayScreen() {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const pressed = usePressedKeys();
  // Only the Cs are labelled on the full piano, with octave numbers to find your way.
  const label = useCallback(
    (midi: number) => names.name(pitchFromMidi(midi), { octave: true }),
    [names],
  );

  return (
    <section className="screen">
      <h1>{t('freePlay.title')}</h1>
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
    </section>
  );
}
