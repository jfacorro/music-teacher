import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { notesAt, scoreEnd, type Score, type ScoreNote } from '../engine/score';
import type { Transport, TransportState } from '../engine/transport';
import { useLiveInput } from '../input/liveStore';

/** Keys currently held on any input, as a set of MIDI numbers. */
export function usePressedKeys(): ReadonlySet<number> {
  const held = useLiveInput((s) => s.held);
  return useMemo(() => new Set(held.map((note) => note.pitch)), [held]);
}

export function useTransportState(transport: Transport): TransportState {
  return useSyncExternalStore(transport.subscribe, transport.getState);
}

/**
 * Follows playback every animation frame: returns the notes sounding now (re-rendering only
 * when that set changes) and pauses the transport once the score has ended.
 */
export function useActiveNotes(score: Score, transport: Transport): ScoreNote[] {
  const [active, setActive] = useState<ScoreNote[]>([]);
  const current = useRef<ScoreNote[]>([]);

  useEffect(() => {
    const end = scoreEnd(score);
    let frame = 0;
    const tick = () => {
      const position = transport.position();
      if (transport.playing && position >= end) transport.pause();
      const now = notesAt(score.notes, position);
      if (now.length !== current.current.length || now.some((n, i) => n !== current.current[i])) {
        current.current = now;
        setActive(now);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, transport]);

  return active;
}
