/**
 * Recordings of a voice singing Match the note (PLAN.md milestone 6.1), for tuning how singing
 * is judged: a WAV file of the microphone audio, which plays anywhere, with each note asked and
 * when the app listened for it in a chunk of its own. Saved into `fixtures/voice/`, where
 * `voiceFixtures.test.ts` replays it through the detector and the matcher.
 */
import { subscribeMicAudio } from './micInput';
import { decodeWav, encodeWav, wavChunk } from './wav';

/**
 * A note asked, timed from the first recorded sample (ms), as the app hears it: readings reach
 * the app on the performance clock, a little after their sound.
 */
export interface RecordedTarget {
  target: number;
  /** When listening for it started (after it was last played). */
  fromMs: number;
  /** When it ended: matched and moved on, or skipped. */
  toMs: number;
  /** How it went while singing: matched, and in time to count. */
  matched: boolean;
  inTime: boolean;
}

/** The run, kept in the WAV file's `json` chunk. */
export interface VoiceRecordingInfo {
  version: 1;
  /** Detector settings in effect while recording. */
  gateDb: number;
  notes: RecordedTarget[];
  recordedAt: string;
}

/** The WAV chunk holding the run. */
const INFO_CHUNK = 'json';

/** A recording as a WAV file (16-bit mono), the run in its `json` chunk. */
export function voiceRecordingWav(
  samples: Float32Array,
  sampleRate: number,
  info: VoiceRecordingInfo,
): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(JSON.stringify(info));
  return encodeWav(samples, sampleRate, [{ id: INFO_CHUNK, bytes }]);
}

/** A recording's audio and run, or null for a WAV file without one. */
export function readVoiceRecording(
  bytes: Uint8Array,
): { samples: Float32Array; sampleRate: number; info: VoiceRecordingInfo } | null {
  const chunk = wavChunk(bytes, INFO_CHUNK);
  if (!chunk) return null;
  const info = JSON.parse(new TextDecoder().decode(chunk)) as VoiceRecordingInfo;
  return { ...decodeWav(bytes), info };
}

/** The longest recording kept: a run is about a minute. */
const MAX_SECONDS = 300;

/**
 * Records the microphone from now on. `note` adds a note asked, with times on the performance
 * clock; `save` returns the recording so far as a file, or null when nothing was heard.
 */
export function startVoiceRecording(gateDb: number): {
  note: (target: Omit<RecordedTarget, 'fromMs' | 'toMs'>, from: number, to: number) => void;
  save: () => Blob | null;
  stop: () => void;
} {
  const hops: Float32Array[] = [];
  let sampleRate = 0;
  let length = 0;
  /** When the first sample reached the app, on the performance clock. */
  let startTime: number | null = null;
  const notes: RecordedTarget[] = [];

  const stop = subscribeMicAudio((samples, _time, rate) => {
    startTime ??= performance.now() - (samples.length / rate) * 1000;
    sampleRate = rate;
    if (length / rate >= MAX_SECONDS) return;
    hops.push(samples);
    length += samples.length;
  });
  const sinceStart = (time: number) => Math.round(time - (startTime ?? time));

  return {
    note(target, from, to) {
      notes.push({ ...target, fromMs: sinceStart(from), toMs: sinceStart(to) });
    },
    save() {
      if (length === 0) return null;
      const audio = new Float32Array(length);
      let offset = 0;
      for (const hop of hops) {
        audio.set(hop, offset);
        offset += hop.length;
      }
      const info: VoiceRecordingInfo = {
        version: 1,
        gateDb,
        notes,
        recordedAt: new Date().toISOString(),
      };
      return new Blob([voiceRecordingWav(audio, sampleRate, info)], { type: 'audio/wav' });
    },
    stop,
  };
}
