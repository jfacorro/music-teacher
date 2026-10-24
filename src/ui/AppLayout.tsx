import {
  IconEar,
  IconEye,
  IconHome,
  IconMenu2,
  IconMusic,
  IconPiano,
  IconSchool,
  IconSettings,
  IconWaveSine,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation } from 'react-router';
import { updateSettings, useSettings } from '../storage/settings';
import { CourseSwitch } from './components/CourseSwitch';
import { InputPicker } from './components/InputPicker';
import { useMediaQuery } from './hooks';
import { useTopBar } from './topBar';
import { COURSE_SECTIONS, Section, SECTION_PATHS, sectionOf } from './sections';
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
  [Section.Tuner]: IconWaveSine,
  [Section.Settings]: IconSettings,
};
const ICON_SIZE = 20;
const ICON_STROKE = 1.75;

export function AppLayout() {
  const { t } = useTranslation();
  const firstLaunchDone = useSettings((s) => s.firstLaunchDone);
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const course = useSettings((s) => s.course);
  const narrow = useMediaQuery(NARROW);
  const [overOpen, setOverOpen] = useState(false);
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const sectionName = t(`nav.${section}`);
  const detail = useTopBar((s) => s.detail);

  // The browser tab says where you are too: "Staccato · Piano Teacher".
  useEffect(() => {
    const where = detail ?? (section === Section.Home ? null : sectionName);
    document.title = where ? t('nav.pageTitle', { where }) : t('appTitle');
  }, [t, detail, section, sectionName]);

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
        {/* Where you are: "Voice / Learn / Unit 1 · Posture", the section leading back to its
            page; the course opens the list of both. */}
        <span className={detail ? 'app-where app-where--detail' : 'app-where'}>
          {firstLaunchDone && <CourseSwitch onChoose={close} />}
          {pathname === SECTION_PATHS[section] ? (
            <span className="app-where__section">{sectionName}</span>
          ) : (
            <Link className="app-where__section" to={SECTION_PATHS[section]} onClick={close}>
              {sectionName}
            </Link>
          )}
          {detail && <span className="app-where__detail">{detail}</span>}
        </span>
        <span className="app-header__spacer" />
        <InputPicker />
      </header>
      <div className="app-body">
        <nav id="app-sidebar" className="app-sidebar" aria-label={t('nav.label')}>
          {COURSE_SECTIONS[course].map((item) => {
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
