import { describe, expect, it } from 'vitest';
import { compare, delayOf, median, noiseFloorFrom, pairNotes, percentile } from './calibration';

const note = (time: number, pitch: number | null = 60) => ({ time, pitch });

describe('statistics', () => {
  it('computes medians and percentiles', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
  });

  it('takes the noise floor from the loud end of quiet levels', () => {
    const levels = [...Array.from({ length: 95 }, () => -65), -50, -50, -50, -50, -50, -Infinity];
    expect(noiseFloorFrom(levels)).toBe(-65);
    expect(noiseFloorFrom([])).toBeNull();
  });
});

describe('pairNotes', () => {
  it('pairs each reference with the nearest detection in the window', () => {
    const { pairs, unpairedReference, unpairedDetected } = pairNotes(
      [note(1000), note(2000), note(3000)],
      [note(1040), note(2600), note(3030), note(3060)],
    );
    expect(pairs.map((p) => p.offsetMs)).toEqual([40, 30]);
    expect(unpairedReference.map((n) => n.time)).toEqual([2000]); // 600 ms later: too late
    expect(unpairedDetected.map((n) => n.time)).toEqual([2600, 3060]);
  });

  it('prefers a detection of the same key', () => {
    const { pairs } = pairNotes([note(1000, 60)], [note(1010, 72), note(1050, 60)]);
    expect(pairs[0]?.detected.pitch).toBe(60);
  });

  it('doesn’t let a missed note take the next note’s detection', () => {
    // 62 at 1000 ms is missed; 64 at 1200 ms is heard at 1210 ms.
    const { pairs, unpairedReference } = pairNotes(
      [note(1000, 62), note(1200, 64)],
      [note(1210, 64)],
    );
    expect(pairs.map((p) => [p.reference.pitch, p.detected.pitch])).toEqual([[64, 64]]);
    expect(unpairedReference.map((n) => n.pitch)).toEqual([62]);
  });

  it('pairs any pitch with references that have none (clicks)', () => {
    const { pairs } = pairNotes([note(1000, null)], [note(1080, 64)]);
    expect(pairs[0]?.offsetMs).toBe(80);
  });
});

describe('delayOf', () => {
  it('reports the median delay and its spread', () => {
    const { pairs } = pairNotes(
      [note(0), note(1000), note(2000), note(3000)],
      [note(50), note(1060), note(2040), note(3200)],
    );
    expect(delayOf(pairs)).toEqual({ latencyMs: 55, jitterMs: 10 });
    expect(delayOf([])).toEqual({ latencyMs: null, jitterMs: null });
  });
});

describe('compare', () => {
  it('classifies microphone detections against MIDI', () => {
    const midi = [note(0, 60), note(500, 62), note(1000, 64), note(1500, 65), note(2000, 67)];
    const mic = [
      note(45, 60), // correct
      note(555, 62), // correct
      note(1050, 76), // octave error
      note(1540, 66), // wrong key
      // 67 missed
      note(2600, 50), // extra (too late for anything)
    ];
    expect(compare(midi, mic)).toEqual({
      reference: 5,
      together: 0,
      detected: 5,
      correct: 2,
      octaveErrors: 1,
      wrongPitch: 1,
      missed: 1,
      extra: 1,
      accuracy: 0.4,
      latencyMs: 50,
      jitterMs: 5,
    });
  });

  it('leaves notes played together out of the score', () => {
    const midi = [note(0, 60), note(1000, 62), note(1020, 65), note(2000, 64)];
    const mic = [note(40, 60), note(1050, 62), note(2040, 64)];
    expect(compare(midi, mic)).toMatchObject({
      reference: 2,
      together: 2,
      correct: 2,
      extra: 0, // the chord's detection isn't counted as extra
      accuracy: 1,
    });
  });
});
