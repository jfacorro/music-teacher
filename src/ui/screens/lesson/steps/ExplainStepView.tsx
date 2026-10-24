import { useMemo } from 'react';
import type { ExplainStep } from '../../../../content/lessons';
import type { ExpectedKey } from '../../../keyboard/PianoKeyboard';
import { MusicPicture, StaffPicture } from '../../../sheet/StaffPicture';
import { StepKeyboard } from './StepKeyboard';

export function ExplainStepView({
  step,
  text,
  keyboard = true,
}: {
  step: ExplainStep;
  text: string;
  /** Show the keyboard (with the step's keys, if any). */
  keyboard?: boolean;
}) {
  const highlight = useMemo(
    () =>
      new Map<number, ExpectedKey>(
        step.keys.map((key) => [
          key.pitch.midi,
          { hand: key.hand ?? step.hand, finger: key.finger },
        ]),
      ),
    [step],
  );

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      {step.staff && (
        <StaffPicture
          clef={step.staff.clef}
          notes={step.staff.notes}
          names={step.staff.names}
          bar={step.staff.bar}
        />
      )}
      {step.music && <MusicPicture score={step.music} />}
      {keyboard && <StepKeyboard range={step.range} highlight={highlight} />}
    </div>
  );
}
