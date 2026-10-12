import { describe, expect, it } from 'vitest';
import { clicksBetween } from './clicks';

const beats = (clicks: { beat: number; accent: boolean }[]) =>
  clicks.map((c) => (c.accent ? `${c.beat}!` : `${c.beat}`));

describe('clicksBetween', () => {
  it('counts in one measure, accenting its first beat, then follows the metronome', () => {
    expect(
      beats(clicksBetween(-6.5, 5, { metronome: true, countInFrom: -4, beatsPerMeasure: 4 })),
    ).toEqual(['-4!', '-3', '-2', '-1', '0!', '1', '2', '3', '4!', '5']);
  });

  it('only counts in when the metronome is off', () => {
    expect(
      beats(clicksBetween(-5, 3, { metronome: false, countInFrom: -3, beatsPerMeasure: 3 })),
    ).toEqual(['-3!', '-2', '-1']);
  });

  it('has no count-in when asked for none', () => {
    expect(
      beats(clicksBetween(-5, 1, { metronome: true, countInFrom: null, beatsPerMeasure: 4 })),
    ).toEqual(['0!', '1']);
  });

  it('excludes the start and includes the end of the window', () => {
    const options = { metronome: true, countInFrom: null, beatsPerMeasure: 4 };
    expect(beats(clicksBetween(1, 2, options))).toEqual(['2']);
    expect(beats(clicksBetween(1.2, 1.9, options))).toEqual([]);
  });

  it('accents measures in other time signatures', () => {
    expect(
      beats(clicksBetween(-1, 6, { metronome: true, countInFrom: null, beatsPerMeasure: 3 })),
    ).toEqual(['0!', '1', '2', '3!', '4', '5', '6!']);
  });
});
