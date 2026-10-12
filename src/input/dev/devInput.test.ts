import { describe, expect, it } from 'vitest';
import { DEV_KEYS, devKeyToPitch } from './devInput';

describe('devKeyToPitch', () => {
  it('maps the home row to white keys from C of the current octave', () => {
    expect(
      ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'].map((code) =>
        devKeyToPitch(code, 4),
      ),
    ).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('maps the upper row to black keys', () => {
    expect(['KeyW', 'KeyE', 'KeyT', 'KeyY', 'KeyU'].map((code) => devKeyToPitch(code, 4))).toEqual([
      61, 63, 66, 68, 70,
    ]);
  });

  it('shifts with the octave', () => {
    expect(devKeyToPitch('KeyA', 3)).toBe(48);
    expect(devKeyToPitch('KeyA', 5)).toBe(72);
  });

  it('ignores unmapped keys', () => {
    expect(devKeyToPitch('KeyQ', 4)).toBeNull();
    expect(devKeyToPitch('Space', 4)).toBeNull();
  });

  it('stays within the 88 piano keys', () => {
    expect(devKeyToPitch('KeyA', 0)).toBeNull(); // C0 = 12, below A0
    expect(devKeyToPitch('KeyH', 0)).toBe(21); // A0
    expect(devKeyToPitch('KeyA', 1)).toBe(24);
    expect(devKeyToPitch('KeyK', 7)).toBe(108); // C8
    expect(devKeyToPitch('KeyO', 7)).toBeNull();
  });

  it('has no two keys on the same semitone', () => {
    const offsets = Object.values(DEV_KEYS);
    expect(new Set(offsets).size).toBe(offsets.length);
  });
});
