import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function HomeScreen() {
  const { t } = useTranslation('screens');
  return (
    <section className="screen">
      <h1>{t('home.title')}</h1>
      <p>{t('home.intro')}</p>
      <div className="button-row">
        <Link className="button button--primary" to="/practice/ode-to-joy">
          {t('home.tryDemo')}
        </Link>
        <Link className="button" to="/settings">
          {t('home.checkKeyboard')}
        </Link>
      </div>
    </section>
  );
}
