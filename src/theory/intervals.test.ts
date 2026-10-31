import { describe, expect, it } from 'vitest';
import { ChordQuality, IntervalName } from './chords';
import { chordNotes, intervalAbove, IntervalNumber, numberAbove } from './intervals';
import { formatNote, pitchOf } from './pitch';

describe('chordNotes', () => {
  const notes = (root: Parameters<typeof pitchOf>[0], quality: ChordQuality) =>
    chordNotes(pitchOf(root), quality).map(formatNote);

  it('spells each kind of chord in thirds', () => {
    expect(notes('D4', ChordQuality.Major)).toEqual(['D4', 'F#4', 'A4']);
    expect(notes('Eb4', ChordQuality.Minor)).toEqual(['Eb4', 'Gb4', 'Bb4']);
    expect(notes('C4', ChordQuality.Diminished)).toEqual(['C4', 'Eb4', 'Gb4']);
    expect(notes('C4', ChordQuality.Augmented)).toEqual(['C4', 'E4', 'G#4']);
    expect(notes('G4', ChordQuality.Dominant7)).toEqual(['G4', 'B4', 'D5', 'F5']);
    expect(notes('C4', ChordQuality.Major7)).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(notes('D4', ChordQuality.Minor7)).toEqual(['D4', 'F4', 'A4', 'C5']);
  });
});

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
