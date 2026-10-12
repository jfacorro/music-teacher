/**
 * Keyboard geometry shared by the on-screen keyboard and the falling-notes view, so note lanes
 * line up exactly with the keys. Units: one white key = 1 wide; heights are 0–1 ratios.
 */
import { PIANO_HIGHEST, PIANO_LOWEST, isBlackKey, pitchClass } from '../../theory/pitch';

export const BLACK_KEY_WIDTH = 0.6;
export const BLACK_KEY_HEIGHT = 0.62;

export interface KeyGeometry {
  midi: number;
  black: boolean;
  /** Left edge, in white-key units. */
  x: number;
  width: number;
}

export interface KeyboardLayout {
  low: number;
  high: number;
  whiteCount: number;
  keys: KeyGeometry[];
  byMidi: ReadonlyMap<number, KeyGeometry>;
}

export const FULL_PIANO: readonly [number, number] = [PIANO_LOWEST, PIANO_HIGHEST];

/** Layout for [low, high], widened so both ends are white keys. */
export function keyboardLayout(low: number, high: number): KeyboardLayout {
  if (isBlackKey(low)) low--;
  if (isBlackKey(high)) high++;

  const keys: KeyGeometry[] = [];
  let whiteIndex = 0;
  for (let midi = low; midi <= high; midi++) {
    if (isBlackKey(midi)) {
      // Centered on the boundary between its two white neighbours.
      keys.push({ midi, black: true, x: whiteIndex - BLACK_KEY_WIDTH / 2, width: BLACK_KEY_WIDTH });
    } else {
      keys.push({ midi, black: false, x: whiteIndex, width: 1 });
      whiteIndex++;
    }
  }
  return { low, high, whiteCount: whiteIndex, keys, byMidi: new Map(keys.map((k) => [k.midi, k])) };
}

/**
 * The key under a point. `x` is in white-key units, `y` is 0 (top) to 1 (bottom).
 * Black keys sit on top, so they win in the upper part.
 */
export function keyAt(layout: KeyboardLayout, x: number, y: number): KeyGeometry | undefined {
  if (y < 0 || y > 1 || x < 0 || x >= layout.whiteCount) return undefined;
  if (y < BLACK_KEY_HEIGHT) {
    const black = layout.keys.find((k) => k.black && x >= k.x && x < k.x + k.width);
    if (black) return black;
  }
  return layout.keys.find((k) => !k.black && x >= k.x && x < k.x + 1);
}

/**
 * A comfortable range for the given notes: from the C at or below the lowest to the C above
 * the highest, widened octave by octave (below first) to at least `minOctaves`.
 */
export function rangeForNotes(midis: readonly number[], minOctaves = 2): [number, number] {
  if (midis.length === 0) return [48, 72]; // C3–C5
  const lowest = Math.min(...midis);
  const highest = Math.max(...midis);
  let low = Math.max(PIANO_LOWEST, lowest - pitchClass(lowest));
  let high = Math.min(PIANO_HIGHEST, highest + ((12 - pitchClass(highest)) % 12));
  let addBelow = true;
  while (high - low < minOctaves * 12) {
    const canBelow = low - 12 >= PIANO_LOWEST;
    const canAbove = high + 12 <= PIANO_HIGHEST;
    if (!canBelow && !canAbove) break;
    if (canBelow && (addBelow || !canAbove)) low -= 12;
    else high += 12;
    addBelow = !addBelow;
  }
  return [low, high];
}
