import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { useSettings } from '../storage/settings';
import { MidiStatusBadge } from './components/MidiStatusBadge';
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
        <span className="app-title">{t('appTitle')}</span>
        <nav className="app-nav" aria-label={t('nav.label')}>
          <NavLink to="/" end>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/free-play">{t('nav.freePlay')}</NavLink>
          <NavLink to="/progress">{t('nav.progress')}</NavLink>
          <NavLink to="/settings">{t('nav.settings')}</NavLink>
        </nav>
        <MidiStatusBadge />
      </header>
      <main className="app-main">{firstLaunchDone ? <Outlet /> : <WelcomeScreen />}</main>
    </div>
  );
}
