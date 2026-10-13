import { describe, expect, it } from 'vitest';
import { bytesFromDataUrl, dataUrlFromBytes, decodeWav, encodeWav } from './wav';

describe('WAV', () => {
  it('round-trips samples through 16-bit PCM', () => {
    const samples = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 10) * 0.8);
    const decoded = decodeWav(encodeWav(samples, 48_000));
    expect(decoded.sampleRate).toBe(48_000);
    expect(decoded.samples).toHaveLength(1000);
    decoded.samples.forEach((sample, i) => expect(sample).toBeCloseTo(samples[i]!, 3)); // 16-bit steps
  });

  it('clamps samples outside -1…1', () => {
    const decoded = decodeWav(encodeWav(Float32Array.from([2, -2]), 8000));
    expect(decoded.samples[0]).toBeCloseTo(1, 3);
    expect(decoded.samples[1]).toBe(-1);
  });

  it('round-trips through data URLs, including long recordings', () => {
    const samples = Float32Array.from({ length: 200_000 }, (_, i) => Math.sin(i / 7) * 0.5);
    const url = dataUrlFromBytes(encodeWav(samples, 48_000), 'audio/wav');
    expect(url.startsWith('data:audio/wav;base64,')).toBe(true);
    const decoded = decodeWav(bytesFromDataUrl(url));
    expect(decoded.samples).toHaveLength(200_000);
    expect(decoded.samples[12_345]).toBeCloseTo(samples[12_345]!, 3);
  });

  it('rejects other files', () => {
    expect(() => decodeWav(new Uint8Array(44))).toThrow('Not a WAV file');
  });
});
