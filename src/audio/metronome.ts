/**
 * Schedules metronome and count-in clicks slightly ahead of time ("look-ahead" scheduling):
 * a timer wakes up often and queues the clicks of the next stretch on the audio clock, which
 * keeps them precise even when the main thread is busy.
 */
import { clicksBetween, type ClickOptions } from '../engine/clicks';
import { msToBeats } from '../engine/score';
import type { Transport } from '../engine/transport';

const WAKE_EVERY_MS = 25;
const LOOK_AHEAD_MS = 120;

/**
 * @param leadMs extra look-ahead, when clicks are played earlier than their beat to make up
 *   for a slow sound device (see the timing correction in audio.ts)
 */
export function startMetronome(
  transport: Transport,
  options: () => ClickOptions,
  click: (time: number, accent: boolean) => void,
  leadMs: () => number = () => 0,
): () => void {
  // Clicks are queued up to here (in beats). A beat exactly at the current position still
  // clicks, so the first count-in beat isn't lost when playback starts on it.
  let queuedUpTo = transport.position() - 1e-6;
  const resync = () => {
    queuedUpTo = transport.position() - 1e-6;
  };
  const unsubscribe = transport.subscribe(resync);

  const timer = setInterval(() => {
    if (!transport.playing) return;
    const horizon = transport.position() + msToBeats(LOOK_AHEAD_MS + leadMs(), transport.tempo);
    for (const { beat, accent } of clicksBetween(queuedUpTo, horizon, options())) {
      click(transport.timeAt(beat), accent);
    }
    queuedUpTo = horizon;
  }, WAKE_EVERY_MS);

  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}
