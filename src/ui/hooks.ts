import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { notesAt, type ScoreNote } from '../engine/score';
import type { Transport, TransportState } from '../engine/transport';
import { useLiveInput } from '../input/liveStore';

/** Keys currently held on any input, as a set of MIDI numbers. */
export function usePressedKeys(): ReadonlySet<number> {
  const held = useLiveInput((s) => s.held);
  return useMemo(() => new Set(held.map((note) => note.pitch)), [held]);
}

/** Whether a CSS media query matches, kept up to date. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

export function useTransportState(transport: Transport): TransportState {
  return useSyncExternalStore(transport.subscribe, transport.getState);
}

/** Runs `callback` on every animation frame while mounted. */
export function useAnimationFrame(callback: () => void): void {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      latest.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
}

/** The notes sounding now; re-renders only when that set changes. */
export function useActiveNotes(notes: readonly ScoreNote[], transport: Transport): ScoreNote[] {
  const [active, setActive] = useState<ScoreNote[]>([]);
  const current = useRef<ScoreNote[]>([]);

  useAnimationFrame(() => {
    const now = notesAt(notes, transport.position());
    if (now.length !== current.current.length || now.some((n, i) => n !== current.current[i])) {
      current.current = now;
      setActive(now);
    }
  });

  return active;
}
