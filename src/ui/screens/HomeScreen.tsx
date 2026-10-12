import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function HomeScreen() {
  const { t } = useTranslation('screens');
  return (
    <section className="screen">
      <h1>{t('home.title')}</h1>
      <p>{t('home.intro')}</p>
      <Link className="button button--primary" to="/settings">
        {t('home.checkKeyboard')}
      </Link>
    </section>
  );
}
