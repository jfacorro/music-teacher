import { describe, expect, it } from 'vitest';
import { formatNote, pitchOf, type NoteString } from '../theory/pitch';
import { Hand, type Score } from './score';
import { fitToRange, transposeScore } from './transpose';

const score = (notes: NoteString[], keyFifths?: number): Score => ({
  tempo: 80,
  timeSignature: [4, 4],
  keyFifths,
  notes: notes.map((name, i) => ({
    pitch: pitchOf(name),
    start: i,
    duration: 1,
    hand: Hand.Right,
  })),
  measures: [{ start: 0, length: 4 }],
});
const names = (moved: Score) => moved.notes.map((note) => formatNote(note.pitch));

describe('transposeScore', () => {
  it('moves by octaves keeping the spelling', () => {
    const moved = transposeScore(score(['C4', 'F#4', 'Bb4']), -12);
    expect(names(moved)).toEqual(['C3', 'F#3', 'Bb3']);
    expect(moved.keyFifths).toBe(0);
  });

  it('moves into the new key, spelled for it', () => {
    const up = transposeScore(score(['C4', 'D4', 'E4', 'F4', 'G4']), 2);
    expect(names(up)).toEqual(['D4', 'E4', 'F#4', 'G4', 'A4']);
    expect(up.keyFifths).toBe(2);
    const down = transposeScore(score(['C4', 'E4', 'G4']), -2);
    expect(names(down)).toEqual(['Bb3', 'D4', 'F4']);
    expect(down.keyFifths).toBe(-2);
    const flat = transposeScore(score(['C4', 'E4']), 1);
    expect(names(flat)).toEqual(['Db4', 'F4']);
  });

  it('keeps the MIDI numbers exact across octaves and keys', () => {
    const moved = transposeScore(score(['G4', 'A4', 'B4'], 1), -17);
    expect(moved.notes.map((note) => note.pitch.midi)).toEqual([67 - 17, 69 - 17, 71 - 17]);
    expect(names(moved)).toEqual(['D3', 'E3', 'F#3']);
  });
});

describe('fitToRange', () => {
  const melody = score(['C4', 'D4', 'E4', 'F4', 'G4']);

  it('moves by octaves first, nearest the comfortable note', () => {
    const bass = fitToRange(melody, { low: 40, high: 62, comfortable: 50 });
    expect(bass.semitones).toBe(-12);
    expect(bass.fits).toBe(true);
    expect(bass.score.notes[0]!.hand).toBe(Hand.Left);
    const soprano = fitToRange(melody, { low: 60, high: 84, comfortable: 74 });
    expect(soprano.semitones).toBe(12);
    expect(soprano.score.notes[0]!.hand).toBe(Hand.Right);
  });

  it('stays where it is when it already fits around the comfortable note', () => {
    expect(fitToRange(melody, { low: 55, high: 72, comfortable: 62 }).semitones).toBe(0);
  });

  it('moves into another key when no octave fits', () => {
    // A range from A3 to F4: C4–G4 doesn't fit, nor does C3–G3.
    const fit = fitToRange(melody, { low: 57, high: 65, comfortable: 61 });
    expect(fit.fits).toBe(true);
    const pitches = fit.score.notes.map((note) => note.pitch.midi);
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(57);
    expect(Math.max(...pitches)).toBeLessThanOrEqual(65);
    expect(fit.semitones % 12).not.toBe(0);
  });

  it('comes as close as it can to a range too narrow', () => {
    const fit = fitToRange(melody, { low: 60, high: 63, comfortable: 61 });
    expect(fit.fits).toBe(false);
  });
});
