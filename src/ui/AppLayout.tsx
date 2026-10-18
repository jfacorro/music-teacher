import {
  IconEar,
  IconEye,
  IconHome,
  IconMenu2,
  IconMusic,
  IconPiano,
  IconSchool,
  IconSettings,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router';
import { updateSettings, useSettings } from '../storage/settings';
import { InputPicker } from './components/InputPicker';
import { useMediaQuery } from './hooks';
import { Section, SECTION_PATHS, SECTIONS, sectionOf } from './sections';
import { WelcomeScreen } from './screens/WelcomeScreen';

/** Below this width there's no room for the sidebar: ☰ slides it over the page instead. */
const NARROW = '(max-width: 760px)';

/** How the sidebar shows: with names, as icons only, not at all, or over the page. */
const SidebarState = {
  Open: 'open',
  Icons: 'icons',
  Hidden: 'hidden',
  Over: 'over',
} as const;
type SidebarState = (typeof SidebarState)[keyof typeof SidebarState];

/** Line icons (Tabler Icons), drawn in the text color. */
const SECTION_ICONS: Readonly<Record<Section, Icon>> = {
  [Section.Home]: IconHome,
  [Section.Learn]: IconSchool,
  [Section.Songs]: IconMusic,
  [Section.SightReading]: IconEye,
  [Section.EarTraining]: IconEar,
  [Section.FreePlay]: IconPiano,
  [Section.Settings]: IconSettings,
};
const ICON_SIZE = 20;
const ICON_STROKE = 1.75;

export function AppLayout() {
  const { t } = useTranslation();
  const firstLaunchDone = useSettings((s) => s.firstLaunchDone);
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const narrow = useMediaQuery(NARROW);
  const [overOpen, setOverOpen] = useState(false);
  const section = sectionOf(useLocation().pathname);

  useEffect(() => {
    document.title = t('appTitle');
  }, [t]);

  // Esc closes the sidebar slid over the page.
  useEffect(() => {
    if (!overOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overOpen]);

  const sidebar: SidebarState = narrow
    ? overOpen
      ? SidebarState.Over
      : SidebarState.Hidden
    : collapsed
      ? SidebarState.Icons
      : SidebarState.Open;
  const toggle = () => {
    if (narrow) setOverOpen((open) => !open);
    else updateSettings({ sidebarCollapsed: !collapsed });
  };
  // Going somewhere closes the sidebar slid over the page.
  const close = () => setOverOpen(false);

  return (
    <div className="app" data-sidebar={sidebar} data-narrow={narrow || undefined}>
      <header className="app-header">
        <button
          type="button"
          className="app-menu-button"
          aria-label={t('nav.menu')}
          aria-expanded={sidebar === SidebarState.Open || sidebar === SidebarState.Over}
          aria-controls="app-sidebar"
          onClick={toggle}
        >
          {sidebar === SidebarState.Over ? (
            <IconX size={ICON_SIZE} stroke={ICON_STROKE} aria-hidden="true" />
          ) : (
            <IconMenu2 size={ICON_SIZE} stroke={ICON_STROKE} aria-hidden="true" />
          )}
        </button>
        {/* The app's icon and name lead home: the progress screen. */}
        <Link
          className="app-title"
          to="/"
          title={t('nav.homeTip')}
          aria-label={t('appTitle')}
          onClick={close}
        >
          <img className="app-title__icon" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
          <span className="app-title__name">{t('appTitle')}</span>
        </Link>
        <span className="app-section">{t(`nav.${section}`)}</span>
        <span className="app-header__spacer" />
        <InputPicker />
      </header>
      <div className="app-body">
        <nav id="app-sidebar" className="app-sidebar" aria-label={t('nav.label')}>
          {SECTIONS.map((item) => {
            const label = t(`nav.${item}`);
            const SectionIcon = SECTION_ICONS[item];
            return (
              <Link
                key={item}
                className={`app-sidebar__link app-sidebar__link--${item}`}
                to={SECTION_PATHS[item]}
                aria-current={item === section ? 'page' : undefined}
                // As icons only, the name shows on hover.
                title={sidebar === SidebarState.Icons ? label : undefined}
                onClick={close}
              >
                <SectionIcon
                  className="app-sidebar__icon"
                  size={ICON_SIZE}
                  stroke={ICON_STROKE}
                  aria-hidden="true"
                />
                <span className="app-sidebar__label">{label}</span>
              </Link>
            );
          })}
        </nav>
        {sidebar === SidebarState.Over && (
          <div className="app-backdrop" aria-hidden="true" onClick={close} />
        )}
        <main className="app-main">{firstLaunchDone ? <Outlet /> : <WelcomeScreen />}</main>
      </div>
    </div>
  );
}
