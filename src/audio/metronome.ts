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
  return scheduleAhead(
    transport,
    (from, to) => {
      for (const { beat, accent } of clicksBetween(from, to, options())) {
        click(transport.timeAt(beat), accent);
      }
    },
    { leadMs },
  );
}
