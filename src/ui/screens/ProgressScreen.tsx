import { useTranslation } from 'react-i18next';

export function ProgressScreen() {
  const { t } = useTranslation('screens');
  return (
    <section className="screen">
      <h1>{t('progress.title')}</h1>
      <p>{t('progress.intro')}</p>
    </section>
  );
}
