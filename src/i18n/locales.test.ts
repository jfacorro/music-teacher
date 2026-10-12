/**
 * Translation checks (PLAN.md §8.4), also run on their own with `npm run i18n:check`:
 * every language has the same files and keys as English, every message is valid ICU,
 * and translations use the same placeholders as the English source.
 */
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import { SOURCE_LANGUAGE, TRANSLATED_LANGUAGES } from './languages';

const files = import.meta.glob<unknown>('/locales/**/*.json', { eager: true, import: 'default' });

/** language → (path inside the language folder → content) */
const byLanguage = new Map<string, Map<string, unknown>>();
for (const [path, content] of Object.entries(files)) {
  const [, , language, ...rest] = path.split('/');
  if (!language) continue;
  const languageFiles = byLanguage.get(language) ?? new Map<string, unknown>();
  languageFiles.set(rest.join('/'), content);
  byLanguage.set(language, languageFiles);
}

function flatten(value: unknown, prefix = ''): Map<string, unknown> {
  const entries = new Map<string, unknown>();
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      for (const [path, leaf] of flatten(child, prefix ? `${prefix}.${key}` : key)) {
        entries.set(path, leaf);
      }
    }
  } else {
    entries.set(prefix, value);
  }
  return entries;
}

/** Argument names used in an ICU message, including inside plural/select branches. */
function argumentNames(message: string, language: string): string[] {
  const names = new Set<string>();
  const visit = (elements: unknown): void => {
    if (!Array.isArray(elements)) return;
    for (const element of elements as Record<string, unknown>[]) {
      // Literal (0) and pound (7) elements carry no argument name.
      if (element.type !== 0 && element.type !== 7 && typeof element.value === 'string') {
        names.add(element.value);
      }
      if (element.options && typeof element.options === 'object') {
        for (const option of Object.values(element.options as Record<string, { value: unknown }>)) {
          visit(option.value);
        }
      }
      visit(element.children);
    }
  };
  visit(new IntlMessageFormat(message, language).getAst());
  return [...names].sort();
}

const source = byLanguage.get(SOURCE_LANGUAGE) ?? new Map<string, unknown>();
const sourceFiles = [...source.keys()].sort();

describe('locale files', () => {
  it('has English source files', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('has no folders for unknown languages', () => {
    expect([...byLanguage.keys()].sort()).toEqual([...TRANSLATED_LANGUAGES].sort());
  });

  describe.each(TRANSLATED_LANGUAGES)('%s', (language) => {
    const translated = byLanguage.get(language) ?? new Map<string, unknown>();

    it('has the same files as English', () => {
      expect([...translated.keys()].sort()).toEqual(sourceFiles);
    });

    describe.each(sourceFiles)('%s', (file) => {
      const sourceEntries = flatten(source.get(file));
      const entries = flatten(translated.get(file));

      it('has the same keys as English', () => {
        const missing = [...sourceEntries.keys()].filter((key) => !entries.has(key));
        const extra = [...entries.keys()].filter((key) => !sourceEntries.has(key));
        expect({ missing, extra }).toEqual({ missing: [], extra: [] });
      });

      it('has only non-empty, valid ICU messages', () => {
        for (const [key, message] of entries) {
          expect(typeof message, key).toBe('string');
          expect((message as string).trim(), key).not.toBe('');
          expect(() => new IntlMessageFormat(message as string, language), key).not.toThrow();
        }
      });

      it('uses the same placeholders as English', () => {
        for (const [key, message] of entries) {
          const sourceMessage = sourceEntries.get(key);
          if (typeof message !== 'string' || typeof sourceMessage !== 'string') continue;
          expect(argumentNames(message, language), key).toEqual(
            argumentNames(sourceMessage, SOURCE_LANGUAGE),
          );
        }
      });
    });
  });
});
