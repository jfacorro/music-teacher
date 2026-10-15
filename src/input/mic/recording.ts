/**
 * Recordings for tuning the note detector with a real piano (PLAN.md §12): the microphone
 * audio plus the MIDI notes played at the same time (the ground truth) and the notes the
 * microphone detected. Saved as a single `<name>.json` (audio embedded as a WAV data URL, since
 * browsers block a second download from one click) into `fixtures/mic/`, where
 * `fixtures.test.ts` replays it through the detector.
 */
import { subscribeRawNotes } from '../bus';
import { subscribeMicAudio } from './micInput';
import { dataUrlFromBytes, encodeWav } from './wav';
import { InputSource } from '../types';
import type { Instrument } from '../routing';
import type { NoteEventType } from '../types';

export interface RecordedEvent {
  source: Instrument;
  type: NoteEventType;
  pitch: number;
  velocity: number;
  /** ms from the first recorded sample */
  timeMs: number;
}

export interface RecordingFile {
  version: 1;
  sampleRate: number;
  /** Detector settings in effect while recording. */
  gateDb: number;
  /** Delay corrections that were applied to the recorded microphone events, ms. */
  micDelayMs: number;
  events: RecordedEvent[];
  recordedAt: string;
  /** The microphone audio: a `data:audio/wav;base64,…` URL (16-bit mono). */
  audio: string;
}

export interface MicRecording {
  file: Blob;
  seconds: number;
}

const MAX_SECONDS = 300;

export function startMicRecording(settings: { gateDb: number; micDelayMs: number }): {
  stop: () => MicRecording | null;
} {
  const hops: Float32Array[] = [];
  let sampleRate = 0;
  let startTime: number | null = null;
  let length = 0;
  const events: (Omit<RecordedEvent, 'timeMs'> & { time: number })[] = [];

  const stopAudio = subscribeMicAudio((samples, time, rate) => {
    startTime ??= time;
    sampleRate = rate;
    if (length / rate >= MAX_SECONDS) return;
    hops.push(samples);
    length += samples.length;
  });
  const stopNotes = subscribeRawNotes((event) => {
    if (event.source !== InputSource.Midi && event.source !== InputSource.Mic) return;
    events.push({
      source: event.source,
      type: event.type,
      pitch: event.pitch,
      velocity: event.velocity,
      time: event.time,
    });
  });

  return {
    stop() {
      stopAudio();
      stopNotes();
      if (startTime === null || length === 0) return null;
      const audio = new Float32Array(length);
      let offset = 0;
      for (const hop of hops) {
        audio.set(hop, offset);
        offset += hop.length;
      }
      const file: RecordingFile = {
        version: 1,
        sampleRate,
        gateDb: settings.gateDb,
        micDelayMs: settings.micDelayMs,
        events: events.map(({ time, ...event }) => ({
          ...event,
          timeMs: Math.round((time - startTime!) * 10) / 10,
        })),
        recordedAt: new Date().toISOString(),
        audio: dataUrlFromBytes(encodeWav(audio, sampleRate), 'audio/wav'),
      };
      return {
        file: new Blob([JSON.stringify(file)], { type: 'application/json' }),
        seconds: length / sampleRate,
      };
    },
  };
}

/** Saves a file through the browser's download. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
