import 'i18next';
import type common from '../../locales/en/common.json';
import type screens from '../../locales/en/screens.json';
import type songs from '../../locales/en/songs.json';

// Type-checked translation keys: English is the source of truth.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof common;
      screens: typeof screens;
      songs: typeof songs;
    };
  }
}
