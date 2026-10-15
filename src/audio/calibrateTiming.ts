/**
 * Tap-along timing calibration for metronome clicks: plays clicks at known times and pairs
 * each with the key the user taps on it (MIDI, computer or on-screen keyboard, whose
 * timestamps are precise). The median offset is how late the clicks are really heard.
 */
import { subscribeRawNotes } from '../input/bus';
import { delayOf, pairNotes, type TimedNote } from '../input/mic/calibration';
import { startAudio } from './audio';
import { NoteEventType, InputSource } from '../input/types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface TimingOptions {
  tempo?: number;
  countIn?: number;
  taps?: number;
  /** Called on every click: 1-based beat, and whether it's still the count-in. */
  onBeat?: (beat: number, countingIn: boolean) => void;
}

export interface TimingResult {
  /** How much later than intended the taps landed, ms (add to the current correction). */
  offsetMs: number | null;
  jitterMs: number | null;
  /** Clicks with a tap. */
  taps: number;
}

export async function measureClickTiming({
  tempo = 90,
  countIn = 4,
  taps = 12,
  onBeat,
}: TimingOptions = {}): Promise<TimingResult> {
  const audio = await startAudio();
  const beatMs = 60_000 / tempo;
  const start = performance.now() + 600;
  const clicks = Array.from({ length: countIn + taps }, (_, i) => start + i * beatMs);
  clicks.forEach((time, i) => {
    audio.click(time, i % 4 === 0);
    setTimeout(() => onBeat?.(i + 1, i < countIn), time - performance.now());
  });

  const tapped: TimedNote[] = [];
  const stop = subscribeRawNotes((event) => {
    // The microphone has its own delay; it's calibrated separately.
    if (event.type === NoteEventType.On && event.source !== InputSource.Mic) {
      tapped.push({ time: event.time, pitch: event.pitch });
    }
  });
  await sleep(clicks.at(-1)! - performance.now() + 800);
  stop();

  const reference = clicks.slice(countIn).map((time) => ({ time, pitch: null }));
  const { pairs } = pairNotes(reference, tapped, { earlyMs: 200, lateMs: 300 });
  const { latencyMs, jitterMs } = delayOf(pairs);
  return { offsetMs: latencyMs, jitterMs, taps: pairs.length };
}
