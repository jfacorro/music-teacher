import { describe, expect, it } from 'vitest';
import { bytesFromDataUrl, dataUrlFromBytes, decodeWav, encodeWav, wavChunk } from './wav';

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

  it('keeps chunks of its own after the audio', () => {
    const notes = new TextEncoder().encode('{"a":1}');
    const bytes = encodeWav(Float32Array.from([0.5, -0.5, 0.25]), 8000, [
      { id: 'json', bytes: notes },
    ]);
    expect(new DataView(bytes.buffer).getUint32(4, true)).toBe(bytes.length - 8);
    expect(decodeWav(bytes).samples).toHaveLength(3);
    expect(new TextDecoder().decode(wavChunk(bytes, 'json')!)).toBe('{"a":1}');
    expect(wavChunk(bytes, 'none')).toBeNull();
  });

  it('rejects other files', () => {
    expect(() => decodeWav(new Uint8Array(44))).toThrow('Not a WAV file');
  });
});
