/** Timing windows and grades (PLAN.md §6.3). All windows are ± milliseconds. */
import { InputSource } from '../input/types';

export const Grade = {
  Perfect: 'perfect',
  Good: 'good',
  Ok: 'ok',
} as const;
export type Grade = (typeof Grade)[keyof typeof Grade];

export interface TimingWindows {
  perfect: number;
  good: number;
  ok: number;
}

export const MIDI_WINDOWS: TimingWindows = { perfect: 50, good: 100, ok: 150 };
/** The microphone adds latency jitter, so it gets wider windows. */
export const MIC_WINDOWS: TimingWindows = { perfect: 80, good: 140, ok: 200 };

export function windowsFor(source: InputSource): TimingWindows {
  return source === InputSource.Mic ? MIC_WINDOWS : MIDI_WINDOWS;
}

/** In wait mode, keys of a chord count as played together if pressed within this time. */
export function chordToleranceFor(source: InputSource): number {
  return source === InputSource.Mic ? 250 : 150;
}

/** Grade for a timing error (negative = early), or null when outside the windows. */
export function gradeFor(errorMs: number, windows: TimingWindows): Grade | null {
  const distance = Math.abs(errorMs);
  if (distance <= windows.perfect) return Grade.Perfect;
  if (distance <= windows.good) return Grade.Good;
  if (distance <= windows.ok) return Grade.Ok;
  return null;
}

export const Timing = {
  Early: 'early',
  OnTime: 'onTime',
  Late: 'late',
} as const;
export type Timing = (typeof Timing)[keyof typeof Timing];

/** Early/late only matters once a note falls outside the "perfect" window. */
export function timingOf(errorMs: number, windows: TimingWindows): Timing {
  if (Math.abs(errorMs) <= windows.perfect) return Timing.OnTime;
  return errorMs < 0 ? Timing.Early : Timing.Late;
}

/** Notes late by this much (ms, the middle one), most of them, are steadily late. */
const STEADY_LATE_MS = 60;
/** Each of "most" notes late by at least half that. */
const STEADY_LATE_SHARE = 2 / 3;
/** Fewer notes say too little. */
const STEADY_LATE_MIN_NOTES = 4;

/**
 * How late the notes came in (ms, the middle one) when most were late by a similar amount;
 * null otherwise. Played along with the metronome, that points at the clicks reaching the player
 * late (Bluetooth headphones), not at the playing: see the timing correction in audio.ts.
 */
export function steadyLatenessMs(errorsMs: readonly number[]): number | null {
  if (errorsMs.length < STEADY_LATE_MIN_NOTES) return null;
  const sorted = [...errorsMs].sort((a, b) => a - b);
  const middle = sorted[Math.floor(sorted.length / 2)]!;
  const late = errorsMs.filter((ms) => ms >= STEADY_LATE_MS / 2).length;
  return middle >= STEADY_LATE_MS && late >= errorsMs.length * STEADY_LATE_SHARE
    ? Math.round(middle)
    : null;
}
