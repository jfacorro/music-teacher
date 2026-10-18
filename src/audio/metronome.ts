/** Schedules metronome and count-in clicks slightly ahead of time (see lookAhead.ts). */
import { clicksBetween, type ClickOptions } from '../engine/clicks';
import type { Transport } from '../engine/transport';
import { scheduleAhead } from './lookAhead';

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
  /** The last beat clicked, so a beat isn't clicked twice. */
  let lastBeat = -Infinity;
  return scheduleAhead(
    transport,
    (from, to) => {
      // Moving back (starting over, a loop) clicks the beats again; going on from where the
      // music waited doesn't click that beat a second time.
      if (from < lastBeat - REPEAT_MARGIN_BEATS) lastBeat = -Infinity;
      for (const { beat, accent } of clicksBetween(from, to, options())) {
        if (beat <= lastBeat) continue;
        click(transport.timeAt(beat), accent);
        lastBeat = beat;
      }
    },
    // Up to and including the beat where the music will wait (wait mode).
    { leadMs, until: () => (options().holdBeat ?? Infinity) + HOLD_MARGIN_BEATS },
  );
}

/** Further back than this is a jump back, not going on after a wait. */
const REPEAT_MARGIN_BEATS = 0.5;
/** Just past the waiting beat, so its own click is included. */
const HOLD_MARGIN_BEATS = 1e-4;
