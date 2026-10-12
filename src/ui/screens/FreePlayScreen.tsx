import { useTranslation } from 'react-i18next';

export function FreePlayScreen() {
  const { t } = useTranslation('screens');
  return (
    <section className="screen">
      <h1>{t('freePlay.title')}</h1>
      <p>{t('freePlay.intro')}</p>
    </section>
  );
}
