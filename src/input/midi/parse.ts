export const MidiMessageKind = {
  NoteOn: 'noteOn',
  NoteOff: 'noteOff',
  Sustain: 'sustain',
} as const;
export type MidiMessageKind = (typeof MidiMessageKind)[keyof typeof MidiMessageKind];

export type MidiMessage =
  | { kind: typeof MidiMessageKind.NoteOn; channel: number; note: number; velocity: number }
  | { kind: typeof MidiMessageKind.NoteOff; channel: number; note: number; velocity: number }
  | { kind: typeof MidiMessageKind.Sustain; channel: number; down: boolean };

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;
const SUSTAIN_PEDAL = 64;

/**
 * Parses one complete MIDI message (Web MIDI never delivers running status).
 * Returns null for everything we don't use, including the clock and active-sensing
 * system messages many keyboards send continuously.
 */
export function parseMidiMessage(data: ArrayLike<number>): MidiMessage | null {
  const status = data[0];
  if (status === undefined || status >= 0xf0) return null;
  const type = status & 0xf0;
  const channel = status & 0x0f;
  const data1 = data[1];
  const data2 = data[2];
  if (data1 === undefined || data2 === undefined) return null;

  switch (type) {
    case NOTE_ON:
      // Note On with velocity 0 is a Note Off by convention.
      return data2 === 0
        ? { kind: MidiMessageKind.NoteOff, channel, note: data1, velocity: 0 }
        : { kind: MidiMessageKind.NoteOn, channel, note: data1, velocity: data2 };
    case NOTE_OFF:
      return { kind: MidiMessageKind.NoteOff, channel, note: data1, velocity: data2 };
    case CONTROL_CHANGE:
      return data1 === SUSTAIN_PEDAL
        ? { kind: MidiMessageKind.Sustain, channel, down: data2 >= 64 }
        : null;
    default:
      return null;
  }
}
