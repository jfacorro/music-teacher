/**
 * "Look-ahead" scheduling: a timer wakes up often and hands over the next stretch of playback,
 * whose sounds are then queued on the audio clock. This keeps them precise even when the main
 * thread is busy.
 */
import { msToBeats } from '../engine/score';
import type { Transport } from '../engine/transport';

const WAKE_EVERY_MS = 25;
const LOOK_AHEAD_MS = 120;

export interface LookAheadOptions {
  /**
   * Extra look-ahead, when sounds are played earlier than their beat to make up for a slow
   * sound device (see the timing correction in audio.ts).
   */
  leadMs?: () => number;
  /** Nothing at or after this beat is handed over yet (e.g. where wait mode stops). */
  until?: () => number;
}

/**
 * Calls `queue(from, to)` with each stretch of playback (beats, from excluded, to included)
 * shortly before it plays. After a jump (seek, pause, play), it continues from the new position.
 */
export function scheduleAhead(
  transport: Transport,
  queue: (from: number, to: number) => void,
  { leadMs = () => 0, until = () => Infinity }: LookAheadOptions = {},
): () => void {
  // A beat exactly at the current position is still handed over, so the first sound isn't
  // lost when playback starts on it.
  let queuedUpTo = transport.position() - 1e-6;
  const unsubscribe = transport.subscribe(() => {
    queuedUpTo = transport.position() - 1e-6;
  });

  const timer = setInterval(() => {
    if (!transport.playing) return;
    const ahead = transport.position() + msToBeats(LOOK_AHEAD_MS + leadMs(), transport.tempo);
    const horizon = Math.min(ahead, until() - 1e-6);
    if (horizon <= queuedUpTo) return;
    queue(queuedUpTo, horizon);
    queuedUpTo = horizon;
  }, WAKE_EVERY_MS);

  return () => {
    clearInterval(timer);
    unsubscribe();
  };
}
