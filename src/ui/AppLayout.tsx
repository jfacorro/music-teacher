import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet } from 'react-router';
import { useSettings } from '../storage/settings';
import { InputPicker } from './components/InputPicker';
import { WelcomeScreen } from './screens/WelcomeScreen';

export function AppLayout() {
  const { t } = useTranslation();
  const firstLaunchDone = useSettings((s) => s.firstLaunchDone);

  useEffect(() => {
    document.title = t('appTitle');
  }, [t]);

  return (
    <div className="app">
      <header className="app-header">
        {/* The app's name leads home: the progress screen. */}
        <Link className="app-title" to="/" title={t('nav.homeTip')}>
          {t('appTitle')}
        </Link>
        <nav className="app-nav" aria-label={t('nav.label')}>
          <NavLink to="/learn">{t('nav.learn')}</NavLink>
          <NavLink to="/free-play">{t('nav.freePlay')}</NavLink>
          <NavLink to="/settings">{t('nav.settings')}</NavLink>
        </nav>
        <InputPicker />
      </header>
      <main className="app-main">{firstLaunchDone ? <Outlet /> : <WelcomeScreen />}</main>
    </div>
  );
}
