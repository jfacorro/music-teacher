import { describe, expect, it } from 'vitest';
import { pitchOf, type NoteString } from './pitch';
import { solfaOf } from './solfa';

const solfa = (note: NoteString, keyFifths?: number) => {
  const { degree, alter } = solfaOf(pitchOf(note), keyFifths);
  return alter === 0 ? degree : `${degree}${alter > 0 ? '+' : '-'}`;
};

describe('solfaOf', () => {
  it('names the key note do, in any key', () => {
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
