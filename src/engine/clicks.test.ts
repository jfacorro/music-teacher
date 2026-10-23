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

  it('counts in before a loop and stops at its end, where playback jumps back', () => {
    const options = {
      metronome: true,
      countInFrom: 4,
      musicStart: 8,
      loopEnd: 12,
      beatsPerMeasure: 4,
    };
    expect(beats(clicksBetween(3, 20, options))).toEqual([
      '4!',
      '5',
      '6',
      '7',
      '8!',
      '9',
      '10',
      '11',
    ]);
  });

  it('accents measures in other time signatures', () => {
    expect(
      beats(clicksBetween(-1, 6, { metronome: true, countInFrom: null, beatsPerMeasure: 3 })),
    ).toEqual(['0!', '1', '2', '3!', '4', '5', '6!']);
  });

  it('clicks dotted quarters in 6/8, two to a bar, counting in one bar', () => {
    expect(
      beats(
        clicksBetween(-3.5, 6, {
          metronome: true,
          countInFrom: -3,
          beatsPerMeasure: 3,
          every: 1.5,
        }),
      ),
    ).toEqual(['-3!', '-1.5', '0!', '1.5', '3!', '4.5', '6!']);
  });
});
