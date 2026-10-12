export type MidiMessage =
  | { kind: 'noteOn'; channel: number; note: number; velocity: number }
  | { kind: 'noteOff'; channel: number; note: number; velocity: number }
  | { kind: 'sustain'; channel: number; down: boolean };

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
        ? { kind: 'noteOff', channel, note: data1, velocity: 0 }
        : { kind: 'noteOn', channel, note: data1, velocity: data2 };
    case NOTE_OFF:
      return { kind: 'noteOff', channel, note: data1, velocity: data2 };
    case CONTROL_CHANGE:
      return data1 === SUSTAIN_PEDAL ? { kind: 'sustain', channel, down: data2 >= 64 } : null;
    default:
      return null;
  }
}
