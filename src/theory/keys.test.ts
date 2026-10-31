import { describe, expect, it } from 'vitest';
import { formatNote, pitchOf } from './pitch';
import {
  keyAlterOf,
  keyFifthsOf,
  keyNames,
  keyNoteNear,
  keyStepOf,
  keyTonic,
  Mode,
  parseKey,
  scaleNotes,
} from './keys';

describe('a key', () => {
  it('finds its signature', () => {
    const major = (note: Parameters<typeof pitchOf>[0]) => keyFifthsOf(pitchOf(note), Mode.Major);
    const minor = (note: Parameters<typeof pitchOf>[0]) => keyFifthsOf(pitchOf(note), Mode.Minor);
    expect(['C4', 'G4', 'D4', 'F4', 'Bb4', 'F#4', 'Cb4'].map((n) => major(n as 'C4'))).toEqual([
      0, 1, 2, -1, -2, 6, -7,
    ]);
    expect(['A4', 'E4', 'D4', 'G4'].map((n) => minor(n as 'A4'))).toEqual([0, 1, -1, -2]);
  });

  it('finds its note from a signature, and back', () => {
    expect(formatNote(keyTonic(-2, Mode.Major))).toBe('Bb4');
    expect(formatNote(keyTonic(2, Mode.Minor))).toBe('B4');
    expect(() => keyTonic(8, Mode.Major)).toThrow(RangeError);
    for (const mode of Object.values(Mode)) {
      for (const name of keyNames(mode)) {
        const key = parseKey(name);
        expect(key.mode).toBe(mode);
        expect(keyTonic(keyFifthsOf(key.tonic, mode), mode)).toEqual(key.tonic);
      }
    }
  });

  it('is written as lessons write it', () => {
    expect(formatNote(parseKey('F#m').tonic)).toBe('F#4');
    expect(parseKey('F#m').mode).toBe(Mode.Minor);
    expect(parseKey('Bb').mode).toBe(Mode.Major);
    expect(keyNames(Mode.Major)).toContain('Gb');
    expect(keyNames(Mode.Minor)).toContain('C#m');
  });

  it('has no signature when it would need a double sharp', () => {
    expect(() => keyFifthsOf(pitchOf('G#4'), Mode.Major)).toThrow(RangeError);
    expect(() => keyFifthsOf(pitchOf('Db4'), Mode.Minor)).toThrow(RangeError);
  });

  it('spells its scale from the signature, up to the next key note', () => {
    expect(scaleNotes(pitchOf('Eb4'), Mode.Major).map(formatNote)).toEqual([
      'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5', 'D5', 'Eb5',
    ]); // prettier-ignore
    expect(scaleNotes(pitchOf('G3'), Mode.Minor).map(formatNote)).toEqual([
      'G3', 'A3', 'Bb3', 'C4', 'D4', 'Eb4', 'F4', 'G4',
    ]); // prettier-ignore
  });
});

describe('key signatures', () => {
  it('give the major key note', () => {
    expect([0, 1, 2, -1, -2, 3, -3].map(keyStepOf)).toEqual(['C', 'G', 'D', 'F', 'B', 'A', 'E']);
  });

  it('alter the letters in order', () => {
    expect(keyAlterOf('F', 1)).toBe(1);
    expect(keyAlterOf('C', 1)).toBe(0);
    expect(keyAlterOf('C', 2)).toBe(1);
    expect(keyAlterOf('B', -1)).toBe(-1);
    expect(keyAlterOf('E', -1)).toBe(0);
    expect(keyAlterOf('E', -2)).toBe(-1);
  });
});

describe('keyNoteNear', () => {
  it('finds the key note nearest the middle of the melody', () => {
    // C to G in C major: the low C. D3 to D4 in G major: the G between.
    expect(keyNoteNear(0, [60, 62, 64, 67])).toBe(60);
    expect(keyNoteNear(1, [50, 55, 62])).toBe(55);
    // F to F: the lower one.
    expect(keyNoteNear(-1, [53, 65])).toBe(53);
    // B♭ major: B♭, not B.
    expect(keyNoteNear(-2, [58, 62, 65])).toBe(58);
  });
});
