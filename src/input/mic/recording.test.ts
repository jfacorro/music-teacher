import { describe, expect, it, vi } from 'vitest';
import { emitNote, setActiveSources } from '../bus';
import { noteOn } from '../../engine/testUtils';
import type { RecordingFile } from './recording';
import { bytesFromDataUrl, decodeWav } from './wav';
import { InputSource } from '../types';

const mic = vi.hoisted(() => ({
  listener: null as ((samples: Float32Array, time: number, rate: number) => void) | null,
}));
vi.mock('./micInput', () => ({
  subscribeMicAudio: (listener: typeof mic.listener) => {
    mic.listener = listener;
    return () => (mic.listener = null);
  },
}));

const { startMicRecording } = await import('./recording');

describe('startMicRecording', () => {
  it('saves the audio and the notes, timed from the first sample', async () => {
    setActiveSources(() => true);
    const recorder = startMicRecording({ gateDb: -50, micDelayMs: 20 });

    // Two hops of audio starting at 1000 ms, 8 kHz.
    mic.listener!(new Float32Array(4).fill(0.5), 1000, 8000);
    emitNote(noteOn(60, 1010, InputSource.Midi));
    emitNote(noteOn(60, 1045, InputSource.Mic));
    emitNote(noteOn(62, 1050, InputSource.Dev)); // not part of a recording
    mic.listener!(new Float32Array(4).fill(-0.5), 1000.5, 8000);

    const recording = recorder.stop()!;
    expect(mic.listener).toBeNull();
    expect(recording.seconds).toBe(8 / 8000);

    const file = JSON.parse(await recording.file.text()) as RecordingFile;
    const audio = decodeWav(bytesFromDataUrl(file.audio));
    expect(audio.sampleRate).toBe(8000);
    expect(audio.samples).toHaveLength(8);
    expect(audio.samples[0]).toBeCloseTo(0.5, 3);
    expect(audio.samples[7]).toBeCloseTo(-0.5, 3);

    expect(file).toMatchObject({ version: 1, sampleRate: 8000, gateDb: -50, micDelayMs: 20 });
    expect(file.events).toEqual([
      { source: 'midi', type: 'on', pitch: 60, velocity: 100, timeMs: 10 },
      { source: 'mic', type: 'on', pitch: 60, velocity: 100, timeMs: 45 },
    ]);
  });

  it('returns nothing when no audio arrived', () => {
    expect(startMicRecording({ gateDb: -50, micDelayMs: 0 }).stop()).toBeNull();
  });
});
