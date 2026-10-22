/**
 * The app's sections, in the sidebar's order, and the section each page belongs to: a lesson is
 * part of Learn, a song's practice and imported songs part of Song practice.
 */
export const Section = {
  Home: 'home',
  Learn: 'learn',
  Songs: 'songs',
  SightReading: 'sightReading',
  EarTraining: 'earTraining',
  FreePlay: 'freePlay',
  Tuner: 'tuner',
  Settings: 'settings',
} as const;
export type Section = (typeof Section)[keyof typeof Section];

export const SECTIONS: readonly Section[] = Object.values(Section);

export const SECTION_PATHS: Readonly<Record<Section, string>> = {
  [Section.Home]: '/',
  [Section.Learn]: '/learn',
  [Section.Songs]: '/songs',
  [Section.SightReading]: '/sight-reading',
  [Section.EarTraining]: '/ear-training',
  [Section.FreePlay]: '/free-play',
  [Section.Tuner]: '/tuner',
  [Section.Settings]: '/settings',
};

/** The paths of each section's pages, its own page included; anything else is Home. */
const SECTION_PAGES: Readonly<Record<Section, readonly string[]>> = {
  [Section.Home]: [],
  [Section.Learn]: ['/learn', '/lesson'],
  [Section.Songs]: ['/songs', '/practice', '/my-songs'],
  [Section.SightReading]: ['/sight-reading'],
  [Section.EarTraining]: ['/ear-training'],
  [Section.FreePlay]: ['/free-play'],
  [Section.Tuner]: ['/tuner'],
  [Section.Settings]: ['/settings'],
};

export function sectionOf(pathname: string): Section {
  return (
    SECTIONS.find((section) =>
      SECTION_PAGES[section].some((path) => pathname === path || pathname.startsWith(`${path}/`)),
    ) ?? Section.Home
  );
}
