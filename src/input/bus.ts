import type { InputSourceKind, NoteEvent, NoteListener } from './types';

/**
 * Fan-out point between input sources and everything that consumes notes. Regular listeners
 * only hear the active sources (see input/routing); raw listeners hear every source, which
 * calibration needs to compare the microphone with MIDI.
 */
const listeners = new Set<NoteListener>();
const rawListeners = new Set<NoteListener>();
let isActive: (source: InputSourceKind) => boolean = () => true;

export function emitNote(event: NoteEvent): void {
  for (const listener of rawListeners) listener(event);
  if (!isActive(event.source)) return;
  for (const listener of listeners) listener(event);
}

export function subscribeNotes(listener: NoteListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeRawNotes(listener: NoteListener): () => void {
  rawListeners.add(listener);
  return () => rawListeners.delete(listener);
}

export function setActiveSources(filter: (source: InputSourceKind) => boolean): void {
  isActive = filter;
}

/**
 * Tracks the keys a source currently holds, so it can release them all when it goes away
 * (device unplugged, window blurred) and consumers never see a stuck note.
 */
export class HeldNotes {
  private readonly held = new Set<number>();
  private readonly source: InputSourceKind;

  constructor(source: InputSourceKind) {
    this.source = source;
  }

  on(pitch: number, velocity: number, time: number): void {
    this.held.add(pitch);
    emitNote({ type: 'on', pitch, velocity, time, source: this.source });
  }

  off(pitch: number, time: number): void {
    if (!this.held.delete(pitch)) return;
    emitNote({ type: 'off', pitch, velocity: 0, time, source: this.source });
  }

  releaseAll(time = performance.now()): void {
    for (const pitch of [...this.held]) this.off(pitch, time);
  }
}
