import i18n, { type BackendModule } from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { LANGUAGES, PSEUDO_LANGUAGE, SOURCE_LANGUAGE } from './languages';
import { pseudoLocalizeResource, type Resource } from './pseudo';

export const NAMESPACES = ['common', 'screens', 'songs', 'feedback', 'courses', 'theory'] as const;

// Lazy: each language/namespace file is its own chunk, loaded on first use. Lesson text uses
// namespaces like "lessons/u1-l2" (locales/<lang>/lessons/u1-l2.json), loaded per lesson.
const loaders = import.meta.glob<Resource>('/locales/**/*.json', { import: 'default' });

async function loadNamespace(language: string, namespace: string): Promise<Resource> {
  if (language === PSEUDO_LANGUAGE) {
    return pseudoLocalizeResource(await loadNamespace(SOURCE_LANGUAGE, namespace));
  }
  const loader = loaders[`/locales/${language}/${namespace}.json`];
  if (!loader) throw new Error(`No translations for ${language}/${namespace}`);
  return loader();
}

const backend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    loadNamespace(language, namespace).then(
      (resource) => callback(null, resource),
      (error: unknown) =>
        callback(error instanceof Error ? error : new Error(String(error)), false),
    );
  },
};

export async function initI18n(language: string): Promise<void> {
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
    window.desktop?.setLanguage(lng); // the desktop app's menu follows
  });

  await i18n
    .use(ICU)
    .use(backend)
    .use(initReactI18next)
    .init({
      lng: language,
      fallbackLng: SOURCE_LANGUAGE,
      supportedLngs: [...LANGUAGES],
      load: 'currentOnly',
      ns: [...NAMESPACES],
      defaultNS: 'common',
      interpolation: { escapeValue: false }, // React escapes
      saveMissing: import.meta.env.DEV,
      missingKeyHandler: (languages, namespace, key) => {
        console.warn(`[i18n] Missing key "${namespace}:${key}" (${languages.join(', ')})`);
      },
    });
}

export function changeLanguage(language: string): Promise<unknown> {
  return i18n.changeLanguage(language);
}

export { i18n };
