import { describe, expect, it } from 'vitest';
import { parseInlineScore } from '../content/loaders/inlineScore';
import {
  beatsToMs,
  countedBeat,
  measureAt,
  msToBeats,
  notesAt,
  notesBetween,
  scoreEnd,
} from './score';

const score = parseInlineScore(
  {
    tempo: 120,
    timeSignature: [4, 4],
    notes: [
      { note: 'C4', start: 0, duration: 1, hand: 'R' },
      { note: 'E4', start: 1, duration: 1, hand: 'R' },
      { note: 'C3', start: 0, duration: 2, hand: 'L' },
      { note: 'G4', start: 4, duration: 2, hand: 'R' },
    ],
  },
  'test',
);

const midis = (notes: { pitch: { midi: number } }[]) => notes.map((n) => n.pitch.midi);

describe('score helpers', () => {
  it('finds where the score ends', () => {
    expect(scoreEnd(score)).toBe(6);
  });

  it('finds the notes sounding at a beat (start inclusive, end exclusive)', () => {
    expect(midis(notesAt(score.notes, 0))).toEqual([48, 60]);
    expect(midis(notesAt(score.notes, 1))).toEqual([48, 64]);
    expect(midis(notesAt(score.notes, 2))).toEqual([]);
    expect(midis(notesAt(score.notes, 5.9))).toEqual([67]);
  });

  it('finds the notes overlapping a window', () => {
    expect(midis(notesBetween(score.notes, 1.5, 4))).toEqual([48, 64]);
    expect(midis(notesBetween(score.notes, 2, 4.1))).toEqual([67]);
  });

  it('finds the measure containing a beat', () => {
    expect(score.measures).toHaveLength(2);
    expect([-2, 0, 3.9, 4, 7, 20].map((beat) => measureAt(score.measures, beat))).toEqual([
      0, 0, 0, 1, 1, 1,
    ]);
  });

  it('converts between beats and milliseconds', () => {
    expect(beatsToMs(2, 120)).toBe(1000);
    expect(msToBeats(1000, 60)).toBe(1);
  });
});

describe('countedBeat', () => {
  it('counts dotted quarters in compound time, quarters otherwise', () => {
    expect(countedBeat([6, 8])).toBe(1.5);
    expect(countedBeat([12, 8])).toBe(1.5);
    expect(countedBeat([3, 8])).toBe(1);
    expect(countedBeat([4, 4])).toBe(1);
    expect(countedBeat([3, 4])).toBe(1);
  });
});
