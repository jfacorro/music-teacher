import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import { SHEET_NOTATIONS, type ScoreView, type SheetNotation } from '../../../content/lessons';
import { ICONS } from '../../icons';

const VIEWS: readonly ScoreView[] = ['falling', 'sheet'];

/** Sheet music level: note names, no names, both staves. */
export function NotationSelect({
  notation,
  onChange,
}: {
  notation: SheetNotation;
  onChange: (notation: SheetNotation) => void;
}) {
  const { t } = useTranslation('screens');
  const id = useId();
  return (
    <label className="inline-field" htmlFor={id}>
      {t('practice.notation.label')}
      <select id={id} value={notation} onChange={(e) => onChange(e.target.value as SheetNotation)}>
        {SHEET_NOTATIONS.map((value) => (
          <option key={value} value={value}>
            {t(`practice.notation.${value}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Switch between falling notes and sheet music. */
export function ViewToggle({
  view,
  onChange,
}: {
  view: ScoreView;
  onChange: (view: ScoreView) => void;
}) {
  const { t } = useTranslation('screens');
  return (
    <div className="segmented" role="radiogroup" aria-label={t('practice.view.label')}>
      {VIEWS.map((value) => (
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
          aria-label={t(`practice.view.${value}`)}
          title={t(`practice.tips.${value}`)}
          onClick={() => onChange(value)}
        >
          <span aria-hidden="true">{ICONS[value]}</span>
        </button>
      ))}
    </div>
  );
}
