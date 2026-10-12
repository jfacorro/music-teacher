/** Timing windows and grades (PLAN.md §6.3). All windows are ± milliseconds. */
import type { InputSourceKind } from '../input/types';

export type Grade = 'perfect' | 'good' | 'ok';

export interface TimingWindows {
  perfect: number;
  good: number;
  ok: number;
}

export const MIDI_WINDOWS: TimingWindows = { perfect: 50, good: 100, ok: 150 };
/** The microphone adds latency jitter, so it gets wider windows. */
export const MIC_WINDOWS: TimingWindows = { perfect: 80, good: 140, ok: 200 };

export function windowsFor(source: InputSourceKind): TimingWindows {
  return source === 'mic' ? MIC_WINDOWS : MIDI_WINDOWS;
}

/** In wait mode, keys of a chord count as played together if pressed within this time. */
export function chordToleranceFor(source: InputSourceKind): number {
  return source === 'mic' ? 250 : 150;
}

/** Grade for a timing error (negative = early), or null when outside the windows. */
export function gradeFor(errorMs: number, windows: TimingWindows): Grade | null {
  const distance = Math.abs(errorMs);
  if (distance <= windows.perfect) return 'perfect';
  if (distance <= windows.good) return 'good';
  if (distance <= windows.ok) return 'ok';
  return null;
}

export type Timing = 'early' | 'onTime' | 'late';

/** Early/late only matters once a note falls outside the "perfect" window. */
export function timingOf(errorMs: number, windows: TimingWindows): Timing {
  if (Math.abs(errorMs) <= windows.perfect) return 'onTime';
  return errorMs < 0 ? 'early' : 'late';
}
