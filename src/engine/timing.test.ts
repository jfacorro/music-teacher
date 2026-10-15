import { describe, expect, it } from 'vitest';
import {
  MIC_WINDOWS,
  MIDI_WINDOWS,
  chordToleranceFor,
  gradeFor,
  timingOf,
  windowsFor,
} from './timing';
import { InputSource } from '../input/types';

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
    expect(windowsFor(InputSource.Midi)).toBe(MIDI_WINDOWS);
    expect(windowsFor(InputSource.Dev)).toBe(MIDI_WINDOWS);
    expect(windowsFor(InputSource.Screen)).toBe(MIDI_WINDOWS);
    expect(windowsFor(InputSource.Mic)).toBe(MIC_WINDOWS);
    expect(chordToleranceFor(InputSource.Midi)).toBe(150);
    expect(chordToleranceFor(InputSource.Mic)).toBe(250);
  });
});
