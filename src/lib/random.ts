/** Random numbers from a seed (mulberry32): the same seed always gives the same numbers. */
export type Random = () => number;

export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** A whole number from 0 to 2³² − 1, for a new seed. */
export function newSeed(random: Random = Math.random): number {
  return Math.floor(random() * 2 ** 32) >>> 0;
}

export function pick<T>(random: Random, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('Nothing to pick from');
  return item;
}

/** Picks an item with a chance in proportion to its weight. */
export function pickWeighted<T>(random: Random, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let left = random() * total;
  for (const [item, weight] of items) {
    left -= weight;
    if (left < 0) return item;
  }
  const last = items.at(-1);
  if (!last) throw new Error('Nothing to pick from');
  return last[0];
}

/** The items in a random order (a new array). */
export function shuffled<T>(random: Random, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * `count` items dealt from `items` like cards from a deck that's reshuffled when empty: each
 * item as evenly as possible, never the same one twice in a row (when there's a choice).
 */
export function dealEvenly<T>(
  random: Random,
  items: readonly T[],
  count: number,
  same: (a: T, b: T) => boolean = Object.is,
): T[] {
  const dealt: T[] = [];
  let deck: T[] = [];
  while (dealt.length < count && items.length > 0) {
    if (deck.length === 0) deck = [...items];
    const previous = dealt.at(-1);
    const choices = deck.filter(
      (item) => deck.length === 1 || previous === undefined || !same(item, previous),
    );
    const item = pick(random, choices.length > 0 ? choices : deck);
    deck.splice(deck.indexOf(item), 1);
    dealt.push(item);
  }
  return dealt;
}
