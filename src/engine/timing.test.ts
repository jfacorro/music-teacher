import { describe, expect, it } from 'vitest';
import {
  MIC_WINDOWS,
  MIDI_WINDOWS,
  chordToleranceFor,
  gradeFor,
  timingOf,
  windowsFor,
} from './timing';

describe('gradeFor', () => {
  it.each([
    [0, 'perfect'],
    [50, 'perfect'],
    [-50, 'perfect'],
    [51, 'good'],
    [-100, 'good'],
    [101, 'ok'],
    [-150, 'ok'],
    [151, null],
    [-400, null],
  ])('MIDI: %i ms → %s', (error, grade) => {
    expect(gradeFor(error, MIDI_WINDOWS)).toBe(grade);
  });

  it('is more forgiving for the microphone', () => {
    expect(gradeFor(80, MIC_WINDOWS)).toBe('perfect');
    expect(gradeFor(200, MIC_WINDOWS)).toBe('ok');
    expect(gradeFor(201, MIC_WINDOWS)).toBeNull();
  });
});

describe('timingOf', () => {
  it('reports early and late outside the perfect window', () => {
    expect(timingOf(-30, MIDI_WINDOWS)).toBe('onTime');
    expect(timingOf(-80, MIDI_WINDOWS)).toBe('early');
    expect(timingOf(120, MIDI_WINDOWS)).toBe('late');
  });
});

describe('per-source settings', () => {
  it('uses MIDI windows for every source except the microphone', () => {
    expect(windowsFor('midi')).toBe(MIDI_WINDOWS);
    expect(windowsFor('dev')).toBe(MIDI_WINDOWS);
    expect(windowsFor('screen')).toBe(MIDI_WINDOWS);
    expect(windowsFor('mic')).toBe(MIC_WINDOWS);
    expect(chordToleranceFor('midi')).toBe(150);
    expect(chordToleranceFor('mic')).toBe(250);
  });
});
