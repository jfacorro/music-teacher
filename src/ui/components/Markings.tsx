import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { isDynamic, markingText, type Marking } from '../../engine/markings';

/**
 * A score's Italian markings ("Moderato", "mf"), each with a tooltip explaining it in the
 * user's language, on hover or keyboard focus.
 */
export function Markings({ markings }: { markings: readonly Marking[] }) {
  if (markings.length === 0) return null;
  return (
    <span className="markings">
      {markings.map((marking) => (
        <MarkingChip key={marking} marking={marking} />
      ))}
    </span>
  );
}

function MarkingChip({ marking }: { marking: Marking }) {
  const { t } = useTranslation('theory');
  const tipId = useId();
  return (
    <span
      className={isDynamic(marking) ? 'marking marking--dynamic' : 'marking'}
      tabIndex={0}
      aria-describedby={tipId}
    >
      {markingText(marking)}
      <span id={tipId} role="tooltip" className="marking__tip">
        {t(`markings.${marking}`)}
      </span>
    </span>
  );
}
