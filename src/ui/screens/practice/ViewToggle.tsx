import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import { SHEET_NOTATIONS, ScoreView, type SheetNotation } from '../../../content/lessons';
import { ICONS } from '../../icons';

const VIEWS: readonly ScoreView[] = [ScoreView.Falling, ScoreView.Sheet];
/** Singing, the falling notes' place is taken by the notes in a lane. */
const LANE = { name: 'lane' } as const;

/** Sheet music level: note names, no names, both staves (or for singing, `SING_NOTATIONS`). */
export function NotationSelect({
  notation,
  onChange,
  options = SHEET_NOTATIONS,
}: {
  notation: SheetNotation;
  onChange: (notation: SheetNotation) => void;
  options?: readonly SheetNotation[];
}) {
  const { t } = useTranslation('screens');
  const id = useId();
  return (
    <label className="inline-field" htmlFor={id}>
      {t('practice.notation.label')}
      <select id={id} value={notation} onChange={(e) => onChange(e.target.value as SheetNotation)}>
        {options.map((value) => (
          <option key={value} value={value}>
            {t(`practice.notation.${value}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Switch between falling notes (for the voice, the notes in a lane) and sheet music. */
export function ViewToggle({
  view,
  onChange,
  lane = false,
}: {
  view: ScoreView;
  onChange: (view: ScoreView) => void;
  /** Singing: the notes go by in a lane instead of falling onto the keys. */
  lane?: boolean;
}) {
  const { t } = useTranslation('screens');
  return (
    <div className="segmented" role="radiogroup" aria-label={t('practice.view.label')}>
      {VIEWS.map((value) => {
        const name = lane && value === ScoreView.Falling ? LANE.name : value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={view === value}
            className={
              view === value
                ? 'segmented__option segmented__option--icon is-selected'
                : 'segmented__option segmented__option--icon'
            }
            aria-label={t(`practice.view.${name}`)}
            title={t(`practice.tips.${name}`)}
            onClick={() => onChange(value)}
          >
            <span aria-hidden="true">{ICONS[name]}</span>
          </button>
        );
      })}
    </div>
  );
}
