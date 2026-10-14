import { useTranslation } from 'react-i18next';
import type { ScoreView } from '../../../content/lessons';

const VIEWS: readonly ScoreView[] = ['falling', 'sheet'];

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
          className={view === value ? 'segmented__option is-selected' : 'segmented__option'}
          onClick={() => onChange(value)}
        >
          {t(`practice.view.${value}`)}
        </button>
      ))}
    </div>
  );
}
