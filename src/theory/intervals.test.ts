import { describe, expect, it } from 'vitest';
import { IntervalName } from './chords';
import { intervalAbove, IntervalNumber, numberAbove } from './intervals';
import { formatNote, pitchOf } from './pitch';

describe('intervalAbove', () => {
  it('spells the note from the letters the interval spans', () => {
    const above = (note: Parameters<typeof pitchOf>[0], interval: IntervalName) =>
      formatNote(intervalAbove(pitchOf(note), interval));
    expect(above('D4', IntervalName.MajorThird)).toBe('F#4');
    expect(above('Eb4', IntervalName.MajorThird)).toBe('G4');
    expect(above('D4', IntervalName.MinorThird)).toBe('F4');
    expect(above('C4', IntervalName.MinorSecond)).toBe('Db4');
    expect(above('B4', IntervalName.MajorSecond)).toBe('C#5');
    expect(above('F4', IntervalName.PerfectFourth)).toBe('Bb4');
    expect(above('B3', IntervalName.PerfectFifth)).toBe('F#4');
    expect(above('G4', IntervalName.Octave)).toBe('G5');
    expect(above('C4', IntervalName.Tritone)).toBe('F#4');
  });

  it('is as wide as the interval, whatever the note', () => {
    expect(intervalAbove(pitchOf('A4'), IntervalName.MajorSixth).midi).toBe(69 + 9);
    expect(intervalAbove(pitchOf('A#3'), IntervalName.MinorSeventh).midi).toBe(58 + 10);
  });

  it('refuses a note that would take more than a double sharp', () => {
    expect(() => intervalAbove(pitchOf('E##4'), IntervalName.MajorSecond)).toThrow(RangeError);
  });
});

describe('numberAbove', () => {
  it('counts note names, staying off sharps and flats', () => {
    const above = (number: IntervalNumber) => formatNote(numberAbove(pitchOf('D4'), number));
    expect(above(IntervalNumber.Second)).toBe('E4');
    expect(above(IntervalNumber.Third)).toBe('F4');
    expect(above(IntervalNumber.Seventh)).toBe('C5');
    expect(above(IntervalNumber.Eighth)).toBe('D5');
  });
});
