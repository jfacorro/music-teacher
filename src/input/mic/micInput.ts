/**
 * Microphone input (PLAN.md §5.2): captures audio with an AudioWorklet, runs the note
 * detector on the main thread and emits `NoteEvent`s with source 'mic'.
 *
 * Timing: each hop carries its audio-clock time. It's mapped to the performance.now() clock,
 * then the track's reported input latency and the calibrated delay are subtracted.
 */
import { create } from 'zustand';
import { HeldNotes } from '../bus';
import { NoteDetector, type PitchReading } from './detector';
import workletUrl from './capture-processor.js?url&no-inline';

export type MicStatus = 'unsupported' | 'off' | 'starting' | 'on' | 'denied' | 'error';

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
  status: isMicSupported() ? 'off' : 'unsupported',
  devices: [],
  deviceId: null,
  levelDb: -Infinity,
  reading: null,
  gateDb: -50,
}));

const HOP_SIZE = 512;
const UI_EVERY_HOPS = 4;
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
const held = new HeldNotes('mic');
const levelListeners = new Set<(levelDb: number) => void>();
type AudioListener = (samples: Float32Array, time: number, sampleRate: number) => void;
const audioListeners = new Set<AudioListener>();

export function setMicGate(gateDb: number): void {
  useMic.setState({ gateDb });
  if (capture) capture.detector.gateDb = gateDb;
}

export function setMicDelay(delayMs: number): void {
  calibratedDelayMs = delayMs;
}

/**
 * Every hop of raw audio, with the time of its first sample on the same timeline as the
 * microphone's note events (for recordings).
 */
export function subscribeMicAudio(listener: AudioListener): () => void {
  audioListeners.add(listener);
  return () => audioListeners.delete(listener);
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
  const devices = await navigator.mediaDevices.enumerateDevices();
  useMic.setState({
    devices: devices
      .filter((device) => device.kind === 'audioinput' && device.deviceId)
      .map((device) => ({ id: device.deviceId, label: device.label })),
  });
}

export async function startMic(deviceId: string | null): Promise<void> {
  if (!isMicSupported()) {
    useMic.setState({ status: 'unsupported' });
    return;
  }
  stopMic();
  useMic.setState({ status: 'starting' });

  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        // Voice-call processing distorts musical tones (PLAN.md §5.2).
        echoCancellation: false,
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
      if (capture === current) stopMic('error');
    });
    await context.resume();

    capture = current;
    useMic.setState({ status: 'on', deviceId: settings?.deviceId ?? deviceId });
    await refreshMicDevices();
  } catch (error) {
    console.warn('Could not start the microphone', error);
    stream?.getTracks().forEach((track) => track.stop());
    void context?.close();
    const denied =
      error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'SecurityError');
    useMic.setState({ status: denied ? 'denied' : 'error' });
  }
}

export function stopMic(status: MicStatus = 'off'): void {
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
    if (event.type === 'on') held.on(event.midi, event.velocity, at);
    else held.off(event.midi, at);
  }

  for (const listener of levelListeners) listener(detector.levelDb);
  if (++current.hops % UI_EVERY_HOPS === 0) {
    useMic.setState({ levelDb: detector.levelDb, reading: detector.reading });
  }
}
