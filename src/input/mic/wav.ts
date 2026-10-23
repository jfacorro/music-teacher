/** Minimal 16-bit PCM mono WAV encoding and decoding, for microphone recordings. */

/** A chunk of its own in a WAV file, after the audio (players skip chunks they don't know). */
export interface WavChunk {
  /** Four ASCII characters. */
  id: string;
  bytes: Uint8Array;
}

export function encodeWav(
  samples: Float32Array,
  sampleRate: number,
  extra: readonly WavChunk[] = [],
): Uint8Array<ArrayBuffer> {
  const dataEnd = 44 + samples.length * 2;
  const padded = (size: number) => size + (size % 2);
  const length = extra.reduce((total, chunk) => total + 8 + padded(chunk.bytes.length), dataEnd);
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));

  text(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  let offset = dataEnd;
  for (const chunk of extra) {
    text(offset, chunk.id);
    view.setUint32(offset + 4, chunk.bytes.length, true);
    bytes.set(chunk.bytes, offset + 8);
    offset += 8 + padded(chunk.bytes.length);
  }
  return bytes;
}

/** The body of the chunk named `id` in a WAV file, or null when it has none. */
export function wavChunk(bytes: Uint8Array, id: string): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = view.getUint32(offset + 4, true);
    if (String.fromCharCode(...bytes.subarray(offset, offset + 4)) === id) {
      return bytes.subarray(offset + 8, offset + 8 + size);
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

export function decodeWav(bytes: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE') throw new Error('Not a WAV file');

  let offset = 12;
  let sampleRate = 0;
  let bits = 0;
  let channels = 0;
  while (offset + 8 <= bytes.length) {
    const id = text(offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === 'data') {
      if (bits !== 16 || channels !== 1) throw new Error('Only 16-bit mono WAV is supported');
      const samples = new Float32Array(size / 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = view.getInt16(body + i * 2, true) / 0x8000;
      }
      return { samples, sampleRate };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV file has no data');
}

/** Encodes bytes as a `data:<type>;base64,…` URL. */
export function dataUrlFromBytes(bytes: Uint8Array, type: string): string {
  let binary = '';
  // In chunks: spreading millions of bytes into one call overflows the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

/** Decodes a `data:…;base64,` URL. */
export function bytesFromDataUrl(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(',') + 1);
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
