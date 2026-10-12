import { useTranslation } from 'react-i18next';

const STAR = '\u2605';
const EMPTY_STAR = '\u2606';

/** ★★☆ with an accessible label ("2 stars out of 3"). */
export function Stars({ stars, size = 'large' }: { stars: number; size?: 'large' | 'small' }) {
  const { t } = useTranslation();
  const count = Math.max(0, Math.min(3, Math.round(stars)));
  return (
    <span className={`stars stars--${size}`} role="img" aria-label={t('stars', { stars: count })}>
      {STAR.repeat(count) + EMPTY_STAR.repeat(3 - count)}
    </span>
  );
}
