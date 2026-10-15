import { create } from 'zustand';
import { subscribeNotes } from './bus';
import { type InputSource, type NoteEvent, NoteEventType } from './types';

const RECENT_LIMIT = 20;

interface LiveInputState {
  /** Keys currently down, sorted low to high. */
  held: NoteEvent[];
  /** Most recent events first. */
  recent: NoteEvent[];
}

export const useLiveInput = create<LiveInputState>(() => ({ held: [], recent: [] }));

/** Forgets held keys from sources that stopped being active, so none stay stuck. */
export function pruneHeld(isActive: (source: InputSource) => boolean): void {
  useLiveInput.setState((state) => ({ held: state.held.filter((note) => isActive(note.source)) }));
}

export function startLiveTracking(): () => void {
  return subscribeNotes((event) => {
    useLiveInput.setState((state) => {
      const others = state.held.filter((note) => note.pitch !== event.pitch);
      return {
        held:
          event.type === NoteEventType.On
            ? [...others, event].sort((a, b) => a.pitch - b.pitch)
            : others,
        recent: [event, ...state.recent].slice(0, RECENT_LIMIT),
      };
    });
  });
}
