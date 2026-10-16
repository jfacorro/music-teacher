import { useCallback, useMemo } from 'react';
import { useNoteNames } from '../../../../i18n/useNoteNames';
import { screenKeyDown, screenKeyUp } from '../../../../input/dev/screenInput';
import { pitchFromMidi } from '../../../../theory/pitch';
import { usePressedKeys } from '../../../hooks';
import { keyboardLayout, keyboardRange } from '../../../keyboard/layout';
import { KeysShown } from '../../../appearance';
import { useSettings } from '../../../../storage/settings';
import { PianoKeyboard, type ExpectedKey } from '../../../keyboard/PianoKeyboard';
import { KeyLabels } from '../../../keyboard/styles';
import type { KeyMark } from '../../../../engine/session';

interface StepKeyboardProps {
  range: [number, number] | null;
  /** Keys to point out; also used for the range when none is given. */
  highlight: ReadonlyMap<number, ExpectedKey>;
  completed?: ReadonlySet<number>;
  marks?: ReadonlyMap<number, KeyMark>;
}

/** The keyboard shown in explain and find steps: playable, with note names on white keys. */
export function StepKeyboard({ range, highlight, completed, marks }: StepKeyboardProps) {
  const names = useNoteNames();
  const pressed = usePressedKeys();
  // A step's own range is kept when keys fit the music; wider choices grow around it.
  const keysShown = useSettings((s) => s.keysShown);
  const layout = useMemo(
    () =>
      keyboardLayout(
        ...(range && keysShown === KeysShown.Fit
          ? range
          : keyboardRange(range ?? [...highlight.keys(), ...(completed ?? [])], keysShown)),
      ),
    [range, highlight, completed, keysShown],
  );
  const label = useCallback(
    (midi: number) => names.name(pitchFromMidi(midi), { octave: false }),
    [names],
  );

  return (
    <div className="lesson__keyboard">
      <PianoKeyboard
        layout={layout}
        pressed={pressed}
        expected={highlight}
        completed={completed}
        marks={marks}
        labels={KeyLabels.White}
        labelFor={label}
        onKeyDown={screenKeyDown}
        onKeyUp={screenKeyUp}
      />
    </div>
  );
}
