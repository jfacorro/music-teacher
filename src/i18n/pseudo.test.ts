import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';
import { pseudoLocalize, pseudoLocalizeResource } from './pseudo';

describe('pseudoLocalize', () => {
  it('accents letters, pads and brackets plain text', () => {
    expect(pseudoLocalize('Settings')).toBe('[Šéţţíñĝš ~~~~]');
  });

  it('keeps simple placeholders intact', () => {
    const result = pseudoLocalize('Connected to {device}.');
    expect(result).toContain('{device}');
    expect(new IntlMessageFormat(result, 'en').format({ device: 'CASIO' })).toContain('CASIO');
  });

  it('accents plural branches but not the plural syntax', () => {
    const result = pseudoLocalize('{count, plural, one {# star} other {# stars}}');
    expect(result).toContain('{count, plural, one {# šţáŕ} other {# šţáŕš}}');
    expect(new IntlMessageFormat(result, 'en').format({ count: 2 })).toContain('2 šţáŕš');
  });

  it('leaves non-letters alone', () => {
    expect(pseudoLocalize('1–2 …')).toBe('[1–2 …]');
  });
});

describe('pseudoLocalizeResource', () => {
  it('transforms nested resources', () => {
    expect(pseudoLocalizeResource({ a: 'Hi', b: { c: 'Ok' } })).toEqual({
      a: '[Ĥí ~]',
      b: { c: '[Óķ ~]' },
    });
  });
});
