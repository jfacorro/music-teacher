import { useMemo } from 'react';
import type { ExplainStep } from '../../../../content/lessons';
import type { ExpectedKey } from '../../../keyboard/PianoKeyboard';
import { StaffPicture } from '../../../sheet/StaffPicture';
import { StepKeyboard } from './StepKeyboard';

export function ExplainStepView({ step, text }: { step: ExplainStep; text: string }) {
  const highlight = useMemo(
    () =>
      new Map<number, ExpectedKey>(
        step.keys.map((key) => [key.pitch.midi, { hand: step.hand, finger: key.finger }]),
      ),
    [step],
  );

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      {step.staff && (
        <StaffPicture clef={step.staff.clef} notes={step.staff.notes} names={step.staff.names} />
      )}
      <StepKeyboard range={step.range} highlight={highlight} />
    </div>
  );
}
