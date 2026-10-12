export type InputSourceKind = 'midi' | 'mic' | 'dev';

/** The one event every input source emits (PLAN.md §4). */
export interface NoteEvent {
  type: 'on' | 'off';
  /** MIDI note number, 60 = middle C. Played notes carry no spelling. */
  pitch: number;
  /** 0–127; estimated for the microphone. */
  velocity: number;
  /** ms on the performance.now() timeline, latency-compensated. */
  time: number;
  source: InputSourceKind;
}

export type NoteListener = (event: NoteEvent) => void;
