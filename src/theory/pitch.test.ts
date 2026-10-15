import { describe, expect, it } from 'vitest';
import {
  InvalidNoteError,
  PIANO_HIGHEST,
  PIANO_LOWEST,
  STEPS,
  formatNote,
  isBlackKey,
  makePitch,
  parseNote,
  pitchFromMidi,
  type Alter,
  Accidentals,
} from './pitch';

describe('parseNote', () => {
  it.each([
    ['C4', 60],
    ['A4', 69],
    ['A0', 21],
    ['C8', 108],
    ['C-1', 0],
    ['G9', 127],
    ['C#4', 61],
    ['Db4', 61],
    ['F#3', 54],
    ['Bb2', 46],
    ['C##4', 62],
    ['Dbb4', 60],
  ])('%s → MIDI %i', (input, midi) => {
    expect(parseNote(input).midi).toBe(midi);
  });

  it('keeps the spelling', () => {
    expect(parseNote('Db4')).toEqual({ midi: 61, step: 'D', alter: -1, octave: 4 });
    expect(parseNote('C#4')).toEqual({ midi: 61, step: 'C', alter: 1, octave: 4 });
  });

  it('treats enharmonic spellings as the same key', () => {
    expect(parseNote('C#4').midi).toBe(parseNote('Db4').midi);
    expect(parseNote('E#4').midi).toBe(parseNote('F4').midi);
    expect(parseNote('Fb4').midi).toBe(parseNote('E4').midi);
  });

  it('ties the octave number to the letter, not the sounding key', () => {
    expect(parseNote('B#3')).toEqual({ midi: 60, step: 'B', alter: 1, octave: 3 });
    expect(parseNote('Cb4')).toEqual({ midi: 59, step: 'C', alter: -1, octave: 4 });
  });

  it.each(['H4', 'c4', 'C♯4', 'C', '4', 'C10', 'Cb', ' C4', 'C4 ', 'C#b4', 'C###4', 'Cbbb4', ''])(
    'rejects %j',
    (input) => {
      expect(() => parseNote(input)).toThrow(InvalidNoteError);
    },
  );

  it('rejects notes outside the MIDI range', () => {
    expect(() => parseNote('G#9')).toThrow(/outside the MIDI range/);
    expect(() => parseNote('Cb-1')).toThrow(/outside the MIDI range/);
  });

  it('names the offending input in the error', () => {
    expect(() => parseNote('H4')).toThrow('Invalid note "H4"');
  });
});

describe('formatNote', () => {
  it('round-trips every spelling within the MIDI range', () => {
    const alters: Alter[] = [-2, -1, 0, 1, 2];
    let checked = 0;
    for (let octave = -1; octave <= 9; octave++) {
      for (const step of STEPS) {
        for (const alter of alters) {
          let pitch;
          try {
            pitch = makePitch(step, alter, octave);
          } catch {
            continue; // outside MIDI range
          }
          expect(parseNote(formatNote(pitch))).toEqual(pitch);
          checked++;
        }
      }
    }
    expect(checked).toBe(372); // 11 octaves × 7 steps × 5 accidentals, minus those outside 0–127
  });
});

describe('pitchFromMidi', () => {
  it('maps every piano key back to the same MIDI number', () => {
    for (let midi = PIANO_LOWEST; midi <= PIANO_HIGHEST; midi++) {
      const sharp = pitchFromMidi(midi);
      const flat = pitchFromMidi(midi, { accidentals: Accidentals.Flats });
      expect(sharp.midi).toBe(midi);
      expect(flat.midi).toBe(midi);
      expect(parseNote(formatNote(sharp)).midi).toBe(midi);
      expect(parseNote(formatNote(flat)).midi).toBe(midi);
    }
  });

  it('spells with sharps by default', () => {
    expect(formatNote(pitchFromMidi(61))).toBe('C#4');
    expect(formatNote(pitchFromMidi(70))).toBe('A#4');
  });

  it('spells with flats when asked or in a flat key', () => {
    expect(formatNote(pitchFromMidi(61, { accidentals: Accidentals.Flats }))).toBe('Db4');
    expect(formatNote(pitchFromMidi(70, { keyFifths: -1 }))).toBe('Bb4');
    expect(formatNote(pitchFromMidi(70, { keyFifths: 2 }))).toBe('A#4');
  });

  it('lets an explicit preference override the key signature', () => {
    expect(formatNote(pitchFromMidi(61, { keyFifths: -3, accidentals: Accidentals.Sharps }))).toBe(
      'C#4',
    );
  });

  it('handles octave boundaries', () => {
    expect(formatNote(pitchFromMidi(59))).toBe('B3');
    expect(formatNote(pitchFromMidi(60))).toBe('C4');
    expect(formatNote(pitchFromMidi(0))).toBe('C-1');
    expect(formatNote(pitchFromMidi(127))).toBe('G9');
  });

  it.each([-1, 128, 60.5, NaN])('rejects %s', (midi) => {
    expect(() => pitchFromMidi(midi)).toThrow(RangeError);
  });
});

describe('isBlackKey', () => {
  it('identifies the black keys of an octave', () => {
    const black = Array.from({ length: 12 }, (_, i) => 60 + i).filter(isBlackKey);
    expect(black).toEqual([61, 63, 66, 68, 70]);
  });
});
