import { describe, expect, it } from 'vitest';
import { parseMidiMessage } from './parse';

describe('parseMidiMessage', () => {
  it('parses Note On', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({
      kind: 'noteOn',
      channel: 0,
      note: 60,
      velocity: 100,
    });
  });

  it('reads the channel from the status byte', () => {
    expect(parseMidiMessage([0x93, 64, 80])).toMatchObject({ kind: 'noteOn', channel: 3 });
  });

  it('treats Note On with velocity 0 as Note Off', () => {
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({
      kind: 'noteOff',
      channel: 0,
      note: 60,
      velocity: 0,
    });
  });

  it('parses Note Off', () => {
    expect(parseMidiMessage([0x80, 60, 64])).toEqual({
      kind: 'noteOff',
      channel: 0,
      note: 60,
      velocity: 64,
    });
  });

  it('parses the sustain pedal', () => {
    expect(parseMidiMessage([0xb0, 64, 127])).toEqual({ kind: 'sustain', channel: 0, down: true });
    expect(parseMidiMessage([0xb0, 64, 0])).toEqual({ kind: 'sustain', channel: 0, down: false });
  });

  it.each([
    ['active sensing', [0xfe]],
    ['timing clock', [0xf8]],
    ['other control change', [0xb0, 7, 100]],
    ['program change', [0xc0, 5]],
    ['pitch bend', [0xe0, 0, 64]],
    ['truncated note on', [0x90, 60]],
    ['empty', []],
  ])('ignores %s', (_, data) => {
    expect(parseMidiMessage(data)).toBeNull();
  });
});
