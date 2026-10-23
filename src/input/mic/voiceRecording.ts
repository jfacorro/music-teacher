/**
 * Recordings of a voice singing Match the note (PLAN.md milestone 6.1), for tuning how singing
 * is judged: the microphone audio, each note asked, and when the app listened for it. Saved as a
 * single `<name>.json` (the audio embedded as a WAV data URL) into `fixtures/voice/`, where
 * `voiceFixtures.test.ts` replays it through the detector and the matcher.
 */
import { subscribeMicAudio } from './micInput';
import { dataUrlFromBytes, encodeWav } from './wav';

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

export interface VoiceRecordingFile {
  version: 1;
  sampleRate: number;
  /** Detector settings in effect while recording. */
  gateDb: number;
  notes: RecordedTarget[];
  recordedAt: string;
  /** The microphone audio: a `data:audio/wav;base64,…` URL (16-bit mono). */
  audio: string;
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
      const file: VoiceRecordingFile = {
        version: 1,
        sampleRate,
        gateDb,
        notes,
        recordedAt: new Date().toISOString(),
        audio: dataUrlFromBytes(encodeWav(audio, sampleRate), 'audio/wav'),
      };
      return new Blob([JSON.stringify(file)], { type: 'application/json' });
    },
    stop,
  };
}
