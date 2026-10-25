import { describe, expect, it } from 'vitest';
import {
  devicesToChoose,
  isUnmeasuredOutput,
  outputDeviceIdOf,
  outputNameOf,
  timingForOutput,
} from './output';

const device = (kind: MediaDeviceKind, deviceId: string, groupId: string, label: string) => ({
  kind,
  deviceId,
  groupId,
  label,
});

const windows = [
  device('audioinput', 'default', 'usb', 'Default - Microphone (USB Audio)'),
  device('audioinput', 'communications', 'cam', 'Communications - Microphone (Webcam)'),
  device('audioinput', 'm1', 'usb', 'Microphone (USB Audio)'),
  device('audioinput', 'm2', 'cam', 'Microphone (Webcam)'),
  device('audiooutput', 'default', 'spk', 'Default - Speakers (Realtek Audio)'),
  device('audiooutput', 'communications', 'spk', 'Communications - Speakers (Realtek Audio)'),
  device('audiooutput', 'a1', 'spk', 'Speakers (Realtek Audio)'),
  device('audiooutput', 'a2', 'bt', 'Headphones (WH-1000XM4)'),
];

describe('devicesToChoose', () => {
  it('lists each device of a kind once, without the stand-ins', () => {
    expect(devicesToChoose(windows, 'audioinput')).toEqual([
      { id: 'm1', label: 'Microphone (USB Audio)' },
      { id: 'm2', label: 'Microphone (Webcam)' },
    ]);
    expect(devicesToChoose(windows, 'audiooutput').map((d) => d.id)).toEqual(['a1', 'a2']);
  });

  it('skips entries without an id (no permission yet)', () => {
    expect(devicesToChoose([device('audioinput', '', '', '')], 'audioinput')).toEqual([]);
  });
});

describe('outputDeviceIdOf', () => {
  it('uses the chosen output while it is connected, else the default', () => {
    expect(outputDeviceIdOf(windows, 'a2')).toBe('a2');
    expect(outputDeviceIdOf(windows, 'gone')).toBe('');
    expect(outputDeviceIdOf(windows, null)).toBe('');
    // A microphone's id is not an output.
    expect(outputDeviceIdOf(windows, 'm1')).toBe('');
  });
});

describe('outputNameOf', () => {
  it('names the chosen output, or the default one when it is not connected', () => {
    expect(outputNameOf(windows, 'a2')).toBe('Headphones (WH-1000XM4)');
    expect(outputNameOf(windows, 'gone')).toBe('Speakers (Realtek Audio)');
  });

  it('names the default output by its own entry', () => {
    expect(
      outputNameOf([
        device('audioinput', 'default', 'mic', 'Default - Microphone'),
        device('audiooutput', 'default', 'bt', 'Default - Headphones (WH-1000XM4)'),
        device('audiooutput', 'a1', 'spk', 'Speakers (Realtek Audio)'),
        device('audiooutput', 'b2', 'bt', 'Headphones (WH-1000XM4)'),
      ]),
    ).toBe('Headphones (WH-1000XM4)');
  });

  it('has no name without outputs, or before the browser gives names', () => {
    expect(outputNameOf([device('audioinput', 'default', 'mic', 'Microphone')])).toBeNull();
    expect(outputNameOf([device('audiooutput', '', '', '')])).toBeNull();
  });
});

describe('timing per output', () => {
  const timings = { 'Headphones (WH-1000XM4)': 190 };

  it('uses the timing measured for the output, and none for an output never measured', () => {
    expect(timingForOutput(timings, 'Headphones (WH-1000XM4)')).toBe(190);
    expect(timingForOutput(timings, 'Speakers (Realtek Audio)')).toBe(0);
    expect(isUnmeasuredOutput(timings, 'Speakers (Realtek Audio)')).toBe(true);
    expect(isUnmeasuredOutput(timings, 'Headphones (WH-1000XM4)')).toBe(false);
  });

  it('keeps the current timing when the output has no name or nothing was measured by name', () => {
    expect(timingForOutput(timings, null)).toBeNull();
    expect(timingForOutput({}, 'Speakers (Realtek Audio)')).toBeNull();
    expect(isUnmeasuredOutput({}, 'Speakers (Realtek Audio)')).toBe(false);
  });
});
