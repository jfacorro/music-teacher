import { describe, expect, it } from 'vitest';
import { MetronomeChoice, metronomeAtStart } from './metronomeChoice';

describe('metronomeAtStart', () => {
  it('follows each exercise on Automatic, and the choice otherwise', () => {
    expect(metronomeAtStart(MetronomeChoice.Auto, true)).toBe(true);
    expect(metronomeAtStart(MetronomeChoice.Auto, false)).toBe(false);
    expect(metronomeAtStart(MetronomeChoice.On, false)).toBe(true);
    expect(metronomeAtStart(MetronomeChoice.Off, true)).toBe(false);
  });
});
