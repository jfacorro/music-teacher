/** Calibration procedures for the Settings screen (PLAN.md §5.4). */
import { startAudio } from '../../audio/audio';
import { subscribeRawNotes } from '../bus';
import type { NoteEvent } from '../types';
import {
  compare,
  delayOf,
  noiseFloorFrom,
  pairNotes,
  type Comparison,
  type TimedNote,
} from './calibration';
import { subscribeMicLevels } from './micInput';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Listens to a few seconds of quiet and returns the background level (dBFS). */
export async function measureNoiseFloor(durationMs = 3000): Promise<number | null> {
  const levels: number[] = [];
  const stop = subscribeMicLevels((level) => levels.push(level));
  await sleep(durationMs);
  stop();
  return noiseFloorFrom(levels);
}

export interface TapOptions {
  tempo?: number;
  countIn?: number;
  taps?: number;
  /** Called on every click: 1-based beat, and whether it's still the count-in. */
  onBeat?: (beat: number, countingIn: boolean) => void;
}

export interface TapResult {
  /** Median remaining delay of the microphone, ms (add it to the current setting). */
  delayMs: number | null;
  jitterMs: number | null;
  /** Clicks with a detected note. */
  taps: number;
}

/** The metronome's own click pitches (A5, E6): if the mic hears them, they aren't taps. */
const CLICK_PITCHES = new Set([81, 88]);

/**
 * Plays metronome clicks and pairs each with the note the user plays on it. The microphone
 * notes' remaining delay is the median offset.
 */
export async function measureDelayByTapping({
  tempo = 80,
  countIn = 4,
  taps = 8,
  onBeat,
}: TapOptions = {}): Promise<TapResult> {
  const audio = await startAudio();
  const beatMs = 60_000 / tempo;
  const start = performance.now() + 600;
  const clicks = Array.from({ length: countIn + taps }, (_, i) => start + i * beatMs);
  clicks.forEach((time, i) => {
    audio.click(time, i % 4 === 0);
    setTimeout(() => onBeat?.(i + 1, i < countIn), time - performance.now());
  });

  const detected: TimedNote[] = [];
  const stop = subscribeRawNotes((event) => {
    if (event.source === 'mic' && event.type === 'on' && !CLICK_PITCHES.has(event.pitch)) {
      detected.push({ time: event.time, pitch: event.pitch });
    }
  });
  await sleep(clicks.at(-1)! - performance.now() + 800);
  stop();

  const reference = clicks.slice(countIn).map((time) => ({ time, pitch: null }));
  const { pairs } = pairNotes(reference, detected);
  const { latencyMs, jitterMs } = delayOf(pairs);
  return { delayMs: latencyMs, jitterMs, taps: pairs.length };
}

/**
 * Compares microphone notes with MIDI notes from the same keyboard as they're played
 * (the Phase 1 checkpoint). Calls `onUpdate` with fresh results; returns a stop function.
 */
export function startMicMidiComparison(onUpdate: (comparison: Comparison) => void): () => void {
  const midi: TimedNote[] = [];
  const mic: TimedNote[] = [];
  let scheduled = false;
  const stop = subscribeRawNotes((event: NoteEvent) => {
    if (event.type !== 'on') return;
    if (event.source === 'midi') midi.push({ time: event.time, pitch: event.pitch });
    else if (event.source === 'mic') mic.push({ time: event.time, pitch: event.pitch });
    else return;
    if (scheduled) return;
    scheduled = true;
    // Batch updates; the microphone's note for a key usually arrives a little later.
    setTimeout(() => {
      scheduled = false;
      onUpdate(compare(midi, mic));
    }, 150);
  });
  onUpdate(compare(midi, mic));
  return stop;
}
