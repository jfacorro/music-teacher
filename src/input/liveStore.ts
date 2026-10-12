import { create } from 'zustand';
import { subscribeNotes } from './bus';
import type { NoteEvent } from './types';

const RECENT_LIMIT = 12;

interface LiveInputState {
  /** Keys currently down, sorted low to high. */
  held: NoteEvent[];
  /** Most recent events first. */
  recent: NoteEvent[];
}

export const useLiveInput = create<LiveInputState>(() => ({ held: [], recent: [] }));

export function startLiveTracking(): () => void {
  return subscribeNotes((event) => {
    useLiveInput.setState((state) => {
      const others = state.held.filter((note) => note.pitch !== event.pitch);
      return {
        held: event.type === 'on' ? [...others, event].sort((a, b) => a.pitch - b.pitch) : others,
        recent: [event, ...state.recent].slice(0, RECENT_LIMIT),
      };
    });
  });
}
