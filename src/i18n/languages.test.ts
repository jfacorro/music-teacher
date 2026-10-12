import { describe, expect, it } from 'vitest';
import { detectLanguage, languageDisplayName } from './languages';

const supported = ['en', 'es'];

describe('detectLanguage', () => {
  it.each([
    [['es'], 'es'],
    [['es-AR', 'en'], 'es'],
    [['EN-gb'], 'en'],
    [['fr', 'es-MX'], 'es'],
    [['fr', 'de'], 'en'],
    [[], 'en'],
  ])('%j → %s', (preferred, expected) => {
    expect(detectLanguage(preferred, supported)).toBe(expected);
  });
});

describe('languageDisplayName', () => {
  it('names each language in itself', () => {
    expect(languageDisplayName('en')).toBe('English');
    expect(languageDisplayName('es')).toBe('Español');
  });
});
