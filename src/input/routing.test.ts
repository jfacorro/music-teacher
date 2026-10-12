import { describe, expect, it } from 'vitest';
import { activeInstrument } from './routing';

describe('activeInstrument', () => {
  it('uses the chosen instrument when not automatic', () => {
    expect(activeInstrument('midi', false, true)).toBe('midi');
    expect(activeInstrument('mic', true, false)).toBe('mic');
  });

  it('prefers a connected MIDI keyboard, then a running microphone', () => {
    expect(activeInstrument('auto', true, true)).toBe('midi');
    expect(activeInstrument('auto', false, true)).toBe('mic');
    expect(activeInstrument('auto', false, false)).toBeNull();
  });
});
