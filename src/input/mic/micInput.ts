/**
 * Microphone input (PLAN.md §5.2): captures audio with an AudioWorklet, runs the note
 * detector on the main thread and emits `NoteEvent`s with source 'mic'.
 *
 * Timing: each hop carries its audio-clock time. It's mapped to the performance.now() clock,
 * then the track's reported input latency and the calibrated delay are subtracted.
 */
import { create } from 'zustand';
import { devicesToChoose, sameDevices } from '../../audio/output';
import { HeldNotes } from '../bus';
import { NoteDetector, type PitchReading, READING_EVERY_HOPS } from './detector';
import workletUrl from './capture-processor.js?url&no-inline';
import { InputSource, NoteEventType } from '../types';

export const MicStatus = {
  Unsupported: 'unsupported',
  Off: 'off',
  Starting: 'starting',
  On: 'on',
  Denied: 'denied',
  Error: 'error',
} as const;
export type MicStatus = (typeof MicStatus)[keyof typeof MicStatus];

export interface MicDevice {
  id: string;
  label: string;
}

interface MicState {
  status: MicStatus;
  devices: MicDevice[];
  deviceId: string | null;
  /** Live level and pitch, updated ~20 times a second for meters. */
  levelDb: number;
  reading: PitchReading | null;
  /** Current gate: noise floor + sensitivity. */
  gateDb: number;
}

export function isMicSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof AudioWorkletNode !== 'undefined'
  );
}

export const useMic = create<MicState>(() => ({
  status: isMicSupported() ? MicStatus.Off : MicStatus.Unsupported,
  devices: [],
  deviceId: null,
  levelDb: -Infinity,
  reading: null,
  gateDb: -50,
}));

const HOP_SIZE = 512;
/** The detector's window (its default), samples. */
const WINDOW_SIZE = 2048;
/** Hops used to estimate the audio clock → performance clock offset (~5 s). */
const CLOCK_WINDOW = 470;

interface Capture {
  context: AudioContext;
  stream: MediaStream;
  nodes: AudioNode[];
  detector: NoteDetector;
  trackLatencyMs: number;
  clockOffsets: number[];
  hops: number;
}

let capture: Capture | null = null;
let calibratedDelayMs = 0;
/** Notes starting before this (performance.now() ms) aren't passed on: the app was playing. */
let ignoredUntil = 0;
const held = new HeldNotes(InputSource.Mic);
const levelListeners = new Set<(levelDb: number) => void>();
type AudioListener = (samples: Float32Array, time: number, sampleRate: number) => void;
const audioListeners = new Set<AudioListener>();
type ReadingListener = (reading: PitchReading | null, time: number) => void;
const readingListeners = new Set<ReadingListener>();
/** Voice-call echo cancellation: off unless chosen (see `setMicEchoCancellation`). */
let echoCancellation = false;

export function setMicGate(gateDb: number): void {
  useMic.setState({ gateDb });
  if (capture) capture.detector.gateDb = gateDb;
}

export function setMicDelay(delayMs: number): void {
  calibratedDelayMs = delayMs;
}

/**
 * Stops passing on notes that start before `time` (performance.now() ms): while the app plays
 * something for the learner to hear (e.g. ear training), the microphone would take its sound
 * for the learner's playing.
 */
export function ignoreMicUntil(time: number): void {
  ignoredUntil = Math.max(ignoredUntil, time);
}

/**
 * Every hop of raw audio, with the time of its first sample on the same timeline as the
 * microphone's note events (for recordings).
 */
export function subscribeMicAudio(listener: AudioListener): () => void {
  audioListeners.add(listener);
  return () => audioListeners.delete(listener);
}

/**
 * Every pitch reading (~20 per second, null when nothing clear is heard), with when it was sung
 * on the same timeline as the microphone's note events: for grading singing.
 */
export function subscribeMicReadings(listener: ReadingListener): () => void {
  readingListeners.add(listener);
  return () => readingListeners.delete(listener);
}

/**
 * Lets the browser take the app's own sound out of the microphone (as in voice calls), to try
 * singing along through speakers; it may bend musical tones (PLAN.md §5.2), so it's off by
 * default. Turning it on or off restarts the microphone when it's on.
 */
export function setMicEchoCancellation(on: boolean): void {
  if (echoCancellation === on) return;
  echoCancellation = on;
  if (capture) void startMic(useMic.getState().deviceId);
}

/** Every hop's level (~90 per second), for noise calibration. */
export function subscribeMicLevels(listener: (levelDb: number) => void): () => void {
  levelListeners.add(listener);
  return () => levelListeners.delete(listener);
}

export async function micPermission(): Promise<PermissionState | 'unknown'> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'unknown';
  }
}

export async function refreshMicDevices(): Promise<void> {
  if (!isMicSupported()) return;
  const devices = devicesToChoose(await navigator.mediaDevices.enumerateDevices(), 'audioinput');
  if (!sameDevices(devices, useMic.getState().devices)) useMic.setState({ devices });
}

/**
 * Asks for the microphone once, without listening, so the browser names the microphones and
 * outputs to choose from. False if it was refused.
 */
export async function allowDeviceNames(): Promise<boolean> {
  if (!isMicSupported()) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
  } catch (error) {
    console.warn('Microphone access was not allowed', error);
    if (useMic.getState().status !== MicStatus.On) useMic.setState({ status: MicStatus.Denied });
    return false;
  }
  await refreshMicDevices();
  return true;
}

/** Errors for a chosen microphone that isn't connected (any more). */
const MISSING_DEVICE = new Set(['OverconstrainedError', 'NotFoundError']);

export async function startMic(deviceId: string | null): Promise<void> {
  if (!isMicSupported()) {
    useMic.setState({ status: MicStatus.Unsupported });
    return;
  }
  stopMic();
  useMic.setState({ status: MicStatus.Starting });

  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        // Voice-call processing distorts musical tones (PLAN.md §5.2); echo cancellation only
        // when chosen, to sing along through speakers.
        echoCancellation,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });
    context = new AudioContext({ latencyHint: 'interactive' });
    await context.audioWorklet.addModule(workletUrl);

    const source = context.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(context, 'capture-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      processorOptions: { hopSize: HOP_SIZE },
    });
    // A silent path to the speakers keeps the graph running in every browser.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(worklet).connect(mute).connect(context.destination);

    const track = stream.getAudioTracks()[0];
    const settings = track?.getSettings() as
      (MediaTrackSettings & { latency?: number }) | undefined;
    const current: Capture = {
      context,
      stream,
      nodes: [source, worklet, mute],
      detector: new NoteDetector({
        sampleRate: context.sampleRate,
        gateDb: useMic.getState().gateDb,
        hopSize: HOP_SIZE,
      }),
      trackLatencyMs: typeof settings?.latency === 'number' ? settings.latency * 1000 : 0,
      clockOffsets: [],
      hops: 0,
    };
    worklet.port.onmessage = (event: MessageEvent<{ samples: Float32Array; frame: number }>) =>
      handleHop(current, event.data.samples, event.data.frame);
    track?.addEventListener('ended', () => {
      if (capture === current) stopMic(MicStatus.Error);
    });
    await context.resume();

    capture = current;
    useMic.setState({ status: MicStatus.On, deviceId: settings?.deviceId ?? deviceId });
    await refreshMicDevices();
  } catch (error) {
    console.warn('Could not start the microphone', error);
    stream?.getTracks().forEach((track) => track.stop());
    void context?.close();
    // The chosen microphone was unplugged: the default one is better than none.
    if (deviceId && error instanceof Error && MISSING_DEVICE.has(error.name)) {
      await startMic(null);
      return;
    }
    const denied =
      error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'SecurityError');
    useMic.setState({ status: denied ? MicStatus.Denied : MicStatus.Error });
  }
}

export function stopMic(status: MicStatus = MicStatus.Off): void {
  if (!capture) return;
  const { context, stream, nodes } = capture;
  capture = null;
  held.releaseAll();
  nodes.forEach((node) => node.disconnect());
  stream.getTracks().forEach((track) => track.stop());
  void context.close();
  useMic.setState({ status, levelDb: -Infinity, reading: null });
}

function handleHop(current: Capture, samples: Float32Array, frame: number): void {
  if (capture !== current) return;
  const { context, detector } = current;
  const time = frame / context.sampleRate;

  // Audio clock → performance clock. currentTime only advances in steps, so a single reading
  // can lag; the smallest offset over the last few seconds is the closest to the truth.
  current.clockOffsets.push(performance.now() - context.currentTime * 1000);
  if (current.clockOffsets.length > CLOCK_WINDOW) current.clockOffsets.shift();
  const clockOffset = Math.min(...current.clockOffsets);

  const toEventTime = (seconds: number) =>
    seconds * 1000 + clockOffset - current.trackLatencyMs - calibratedDelayMs;
  for (const listener of audioListeners) listener(samples, toEventTime(time), context.sampleRate);

  for (const event of detector.process(samples, time)) {
    const at = toEventTime(event.time);
    if (event.type === NoteEventType.Off) held.off(event.midi, at);
    else if (at >= ignoredUntil) held.on(event.midi, event.velocity, at);
  }

  for (const listener of levelListeners) listener(detector.levelDb);
  if (++current.hops % READING_EVERY_HOPS === 0) {
    useMic.setState({ levelDb: detector.levelDb, reading: detector.reading });
    // A reading is of the detector's window, which ends with this hop: timed at its middle.
    const sungAt = toEventTime(time + (HOP_SIZE - WINDOW_SIZE / 2) / context.sampleRate);
    for (const listener of readingListeners) listener(detector.reading, sungAt);
  }
}
