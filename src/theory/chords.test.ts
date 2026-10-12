import { describe, expect, it } from 'vitest';
import { identifyChord, identifyInterval, rootSpelling } from './chords';
import { parseNote } from './pitch';

const midis = (...notes: string[]) => notes.map((note) => parseNote(note).midi);

describe('identifyChord', () => {
  it.each([
    [['C4', 'E4', 'G4'], { root: 0, quality: 'major', bass: 0 }],
    [['A3', 'C4', 'E4'], { root: 9, quality: 'minor', bass: 9 }],
    [['B3', 'D4', 'F4'], { root: 11, quality: 'diminished', bass: 11 }],
    [['C4', 'E4', 'G#4'], { root: 0, quality: 'augmented', bass: 0 }],
    [['C4', 'D4', 'G4'], { root: 0, quality: 'sus2', bass: 0 }],
    [['C4', 'F4', 'G4'], { root: 0, quality: 'sus4', bass: 0 }],
    [['G3', 'B3', 'D4', 'F4'], { root: 7, quality: 'dominant7', bass: 7 }],
    [['C4', 'E4', 'G4', 'B4'], { root: 0, quality: 'major7', bass: 0 }],
    [['D4', 'F4', 'A4', 'C5'], { root: 2, quality: 'minor7', bass: 2 }],
    [['B3', 'D4', 'F4', 'A4'], { root: 11, quality: 'halfDiminished7', bass: 11 }],
    [['B3', 'D4', 'F4', 'Ab4'], { root: 11, quality: 'diminished7', bass: 11 }],
  ])('%j', (notes, chord) => {
    expect(identifyChord(midis(...notes))).toEqual(chord);
  });

  it('recognizes inversions and spread voicings, keeping the bass', () => {
    expect(identifyChord(midis('E3', 'G3', 'C4'))).toEqual({ root: 0, quality: 'major', bass: 4 });
    expect(identifyChord(midis('G2', 'C4', 'E5'))).toEqual({ root: 0, quality: 'major', bass: 7 });
    expect(identifyChord(midis('C3', 'C4', 'E4', 'G4', 'C5'))).toEqual({
      root: 0,
      quality: 'major',
      bass: 0,
    });
  });

  it('names symmetric chords from the bass', () => {
    expect(identifyChord(midis('E4', 'G#4', 'C5'))).toMatchObject({
      root: 4,
      quality: 'augmented',
    });
  });

  it('returns null for fewer than three notes or unknown sets', () => {
    expect(identifyChord([])).toBeNull();
    expect(identifyChord(midis('C4', 'E4'))).toBeNull();
    expect(identifyChord(midis('C4', 'C#4', 'D4'))).toBeNull();
  });
});

describe('identifyInterval', () => {
  it.each([
    [['C4', 'C#4'], 'minorSecond'],
    [['C4', 'E4'], 'majorThird'],
    [['C4', 'G4'], 'perfectFifth'],
    [['C4', 'F#4'], 'tritone'],
    [['C4', 'C5'], 'octave'],
    [['C3', 'E4'], 'majorThird'],
  ])('%j → %s', (notes, name) => {
    expect(identifyInterval(midis(...notes))).toBe(name);
  });

  it('measures upwards from the lower key, whatever the order', () => {
    expect(identifyInterval(midis('E4', 'C4'))).toBe('majorThird');
    expect(identifyInterval(midis('E3', 'C4'))).toBe('minorSixth');
  });

  it('needs exactly two different keys', () => {
    expect(identifyInterval(midis('C4'))).toBeNull();
    expect(identifyInterval(midis('C4', 'E4', 'G4'))).toBeNull();
  });
});

describe('rootSpelling', () => {
  it('uses the common spelling for chord roots', () => {
    expect(rootSpelling(1)).toEqual({ step: 'C', alter: 1 });
    expect(rootSpelling(3)).toEqual({ step: 'E', alter: -1 });
    expect(rootSpelling(10)).toEqual({ step: 'B', alter: -1 });
  });
});
