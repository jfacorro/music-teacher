/**
 * Plays the hand that isn't being practiced (PLAN.md §2.3), on time with the transport. In wait
 * mode it waits too: notes from where the music stops sound once the learner plays on.
 */
import type { ScoreNote } from '../engine/score';
import type { Transport } from '../engine/transport';
import { scheduleAhead } from './lookAhead';

export interface AccompanimentOptions {
  enabled: boolean;
  notes: readonly ScoreNote[];
  /** Only notes starting in [from, until) play: the practiced music, up to where it stops. */
  from: number;
  until: number;
}

/** @param play a note heard from `start` to `end` (performance.now() ms) */
export function startAccompaniment(
  transport: Transport,
  options: () => AccompanimentOptions,
  play: (note: ScoreNote, start: number, end: number) => void,
  leadMs: () => number = () => 0,
): () => void {
  return scheduleAhead(
    transport,
    (from, to) => {
      const { enabled, notes, from: first } = options();
      if (!enabled) return;
      for (const note of notes) {
        if (note.start > from && note.start <= to && note.start >= first) {
          play(note, transport.timeAt(note.start), transport.timeAt(note.start + note.duration));
        }
      }
    },
    { leadMs, until: () => options().until },
  );
}
