import { describe, expect, it } from 'vitest';
import { newSeed, pick, pickWeighted, seededRandom, shuffled } from './random';

describe('seededRandom', () => {
  it('gives the same numbers for the same seed, in [0, 1)', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const numbers = Array.from({ length: 100 }, () => a());
    expect(Array.from({ length: 100 }, () => b())).toEqual(numbers);
    for (const n of numbers) expect(n >= 0 && n < 1).toBe(true);
    expect(seededRandom(8)()).not.toBe(numbers[0]);
  });
});

describe('picking', () => {
  it('never picks an item without weight', () => {
    const random = seededRandom(1);
    for (let i = 0; i < 200; i++) {
      expect(
        pickWeighted(random, [
          ['a', 1],
          ['b', 0],
          ['c', 3],
        ]),
      ).not.toBe('b');
    }
  });

  it('picks from the items, and shuffles all of them', () => {
    const random = seededRandom(2);
    expect([1, 2, 3]).toContain(pick(random, [1, 2, 3]));
    expect(() => pick(random, [])).toThrow();
    expect([...shuffled(random, [1, 2, 3, 4])].sort()).toEqual([1, 2, 3, 4]);
  });

  it('makes seeds that fit in 32 bits', () => {
    expect(newSeed(() => 0.999999999)).toBeLessThan(2 ** 32);
    expect(newSeed(() => 0)).toBe(0);
  });
});
