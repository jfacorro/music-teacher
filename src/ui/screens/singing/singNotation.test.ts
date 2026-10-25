import { describe, expect, it } from 'vitest';
import { SheetNotation } from '../../../content/lessons';
import { NamingSystem } from '../../../i18n/naming';
import { singNotations, startNotation } from './singNotation';

describe('sung sheet music', () => {
  it('offers do, re, mi only with letter note names', () => {
    expect(singNotations(NamingSystem.English)).toContain(SheetNotation.Syllables);
    expect(singNotations(NamingSystem.German)).toContain(SheetNotation.Syllables);
    expect(singNotations(NamingSystem.Solfege)).toEqual([SheetNotation.Names, SheetNotation.Plain]);
  });

  it('starts with do, re, mi for letters and the note names for solfège', () => {
    expect(startNotation(NamingSystem.English, null)).toBe(SheetNotation.Syllables);
    expect(startNotation(NamingSystem.Solfege, null)).toBe(SheetNotation.Names);
    expect(startNotation(NamingSystem.Solfege, SheetNotation.Syllables)).toBe(SheetNotation.Names);
    expect(startNotation(NamingSystem.Solfege, SheetNotation.Plain)).toBe(SheetNotation.Plain);
    expect(startNotation(NamingSystem.English, SheetNotation.Names)).toBe(SheetNotation.Names);
  });
});
