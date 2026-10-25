import { describe, expect, it } from 'vitest';
import { keyAlterOf, keyNoteNear, keyStepOf } from './keys';

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
