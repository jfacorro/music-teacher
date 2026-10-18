import { describe, expect, it } from 'vitest';
import { isUnmeasuredOutput, outputNameOf, timingForOutput } from './output';

const device = (kind: MediaDeviceKind, deviceId: string, groupId: string, label: string) => ({
  kind,
  deviceId,
  groupId,
  label,
});

describe('outputNameOf', () => {
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
