import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExplainStep } from '../../../../content/lessons';
import type { ExpectedKey } from '../../../keyboard/PianoKeyboard';
import { MusicPicture, StaffPicture } from '../../../sheet/StaffPicture';
import { StepKeyboard } from './StepKeyboard';

export function ExplainStepView({
  step,
  text,
  keyboard = true,
  met = null,
}: {
  step: ExplainStep;
  text: string;
  /** Show the keyboard (with the step's keys, if any). */
  keyboard?: boolean;
  /** Where this was met already: it folds to that one line, which opens to read in full. */
  met?: string | null;
}) {
  const { t } = useTranslation('screens');
  const [open, setOpen] = useState(false);
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
      {met !== null && (
        <button type="button" className="recap" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>{met}</span>
          <span className="recap__toggle">
            {open ? (
              <IconChevronUp size={14} aria-hidden="true" />
            ) : (
              <IconChevronDown size={14} aria-hidden="true" />
            )}
            {t(open ? 'lesson.recap.close' : 'lesson.recap.open')}
          </span>
        </button>
      )}
      {(met === null || open) && (
        <>
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
        </>
      )}
    </div>
  );
}
