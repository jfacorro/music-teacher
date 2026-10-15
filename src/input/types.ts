export const NoteEventType = {
  On: 'on',
  Off: 'off',
} as const;
export type NoteEventType = (typeof NoteEventType)[keyof typeof NoteEventType];

/** `dev`: computer keyboard; `screen`: clicking/touching the on-screen keyboard. */
export const InputSource = {
  Midi: 'midi',
  Mic: 'mic',
  Dev: 'dev',
  Screen: 'screen',
} as const;
export type InputSource = (typeof InputSource)[keyof typeof InputSource];

/** The one event every input source emits (PLAN.md §4). */
export interface NoteEvent {
  type: NoteEventType;
  /** MIDI note number, 60 = middle C. Played notes carry no spelling. */
  pitch: number;
  /** 0–127; estimated for the microphone. */
  velocity: number;
  /** ms on the performance.now() timeline, latency-compensated. */
  time: number;
  source: InputSource;
}

export type NoteListener = (event: NoteEvent) => void;

/** Which instrument the app listens to: MIDI, the microphone, or whichever is connected. */
export const InputMode = {
  Auto: 'auto',
  Midi: 'midi',
  Mic: 'mic',
} as const;
export type InputMode = (typeof InputMode)[keyof typeof InputMode];

/** The instrument being listened to. */
export const Instrument = {
  Midi: 'midi',
  Mic: 'mic',
} as const;
export type Instrument = (typeof Instrument)[keyof typeof Instrument];
