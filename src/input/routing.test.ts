import { describe, expect, it } from 'vitest';
import { activeInstrument, InputMode } from './routing';

describe('activeInstrument', () => {
  it('uses the chosen instrument when not automatic', () => {
    expect(activeInstrument(InputMode.Midi, false, true)).toBe('midi');
    expect(activeInstrument(InputMode.Mic, true, false)).toBe('mic');
  });

  it('prefers a connected MIDI keyboard, then a running microphone', () => {
    expect(activeInstrument(InputMode.Auto, true, true)).toBe('midi');
    expect(activeInstrument(InputMode.Auto, false, true)).toBe('mic');
    expect(activeInstrument(InputMode.Auto, false, false)).toBeNull();
  });
});
