import { describe, expect, it } from 'vitest';
import { DEFAULT_VOLUMES, volumeDb } from './volume';

describe('volumeDb', () => {
  it('is the full level at 100 % and silent at 0', () => {
    expect(volumeDb(100)).toBe(0);
    expect(volumeDb(0)).toBe(-Infinity);
    expect(volumeDb(120)).toBe(0);
  });

  it('drops about 12 dB each time the slider halves', () => {
    expect(volumeDb(50)).toBeCloseTo(-12, 0);
    expect(volumeDb(25)).toBeCloseTo(-24, 0);
  });

  it('puts the click under the piano by default', () => {
    expect(volumeDb(DEFAULT_VOLUMES.metronome)).toBeLessThan(volumeDb(DEFAULT_VOLUMES.piano));
  });
});
