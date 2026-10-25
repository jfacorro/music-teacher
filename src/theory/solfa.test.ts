import { describe, expect, it } from 'vitest';
import { pitchOf, type NoteString } from './pitch';
import { keyNoteNear, keyStepOf, solfaOf } from './solfa';

const solfa = (note: NoteString, keyFifths?: number) => {
  const { degree, alter } = solfaOf(pitchOf(note), keyFifths);
  return alter === 0 ? degree : `${degree}${alter > 0 ? '+' : '-'}`;
};

describe('solfaOf', () => {
  it('names the key note do, in any key', () => {
    expect([0, 1, 2, -1, -2, 3, -3].map(keyStepOf)).toEqual(['C', 'G', 'D', 'F', 'B', 'A', 'E']);
    expect(solfa('C4')).toBe('do');
    expect(solfa('G3', 1)).toBe('do');
    expect(solfa('Bb4', -2)).toBe('do');
  });

  it('follows the major scale from do', () => {
    const g = ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'] as const;
    expect(g.map((note) => solfa(note, 1))).toEqual([
      'do',
      're',
      'mi',
      'fa',
      'sol',
      'la',
      'ti',
      'do',
    ]);
    expect(solfa('Eb4', -2)).toBe('fa');
  });

  it('marks notes outside the key as raised or lowered', () => {
    expect(solfa('F#4')).toBe('fa+');
    expect(solfa('F4', 1)).toBe('ti-');
    expect(solfa('B4', -1)).toBe('fa+');
  });
});

describe('keyNoteNear', () => {
  it('finds the do nearest the middle of the melody', () => {
    // Do to sol in C: low do. Sol below to sol in G: the do between.
    expect(keyNoteNear(0, [60, 62, 64, 67])).toBe(60);
    expect(keyNoteNear(1, [50, 55, 62])).toBe(55);
    // Do to do: the lower one.
    expect(keyNoteNear(-1, [53, 65])).toBe(53);
  });
});
