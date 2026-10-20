import { describe, expect, it } from 'vitest';
import { matchesQuery } from './text';

describe('matchesQuery', () => {
  it('finds the query anywhere in any of the texts, ignoring case and accents', () => {
    expect(matchesQuery('river', 'Moon River', 'Henry Mancini')).toBe(true);
    expect(matchesQuery('MANCINI', 'Moon River', 'Henry Mancini')).toBe(true);
    expect(matchesQuery('cancan', 'Cancán', null)).toBe(true);
    expect(matchesQuery('cancán', 'Can-Can', null)).toBe(false);
    expect(matchesQuery('waltz', 'Moon River', null)).toBe(false);
  });

  it('matches everything when the query is empty or only spaces', () => {
    expect(matchesQuery('', 'Moon River', null)).toBe(true);
    expect(matchesQuery('  ', 'Moon River', null)).toBe(true);
  });
});
