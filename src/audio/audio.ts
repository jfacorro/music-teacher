/**
 * Sound output via Tone.js, loaded on demand. Browsers only allow audio after a user gesture,
 * so call `startAudio()` from a click handler (e.g. Play).
 *
 * Everything else in the app runs on the performance.now() clock; `audioTimeFor` converts
 * those times to the audio clock, compensating for output latency, so clicks are heard
 * exactly when the visuals hit the beat. Browsers don't always report the full output delay
 * (it depends on the sound device and drivers), so a timing correction measured by tapping
 * along (Settings) moves clicks earlier by the rest.
 */
import type { NoteString } from '../theory/pitch';
import { DEFAULT_VOLUMES, volumeDb, type Volumes } from './volume';

export interface AudioEngine {
  /** Metronome click heard at `time` (performance.now() ms). */
  click(time: number, accent: boolean): void;
  /** Piano-like note, right now. */
  noteOn(midi: number, velocity: number): void;
  noteOff(midi: number): void;
  /**
   * A note of the other hand (or of a recording played back), heard from `start` to `end`
   * (performance.now() ms), as loud as `velocity` (0–1).
   */
  accompany(midi: number, start: number, end: number, velocity?: number): void;
  /** Silences the other hand (on pause or restart). */
  stopAccompaniment(): void;
  /** Time from playing a sound to hearing it, as reported by the browser, ms. */
  outputDelayMs(): number;
  setVolumes(volumes: Volumes): void;
}

/** Metronome clicks: higher on the first beat of the bar. */
const ACCENT_CLICK: NoteString = 'E6';
const BEAT_CLICK: NoteString = 'A5';

/** Levels at 100 % volume, dB. */
const CLICK_FULL_DB = -4;
const PIANO_FULL_DB = -6;

const MAX_LATE_S = 0.03;
/** A note of the other hand may start late by this much (better late than missing). */
const MAX_LATE_NOTE_S = 0.1;

let timingCorrectionMs = 0;
let volumes: Volumes = DEFAULT_VOLUMES;

/** Metronome and piano volume (also before the audio has started). */
export function setVolumes(next: Volumes): void {
  volumes = next;
  ready?.setVolumes(next);
}

/** Extra output delay to compensate, from tap-along calibration (ms; negative = later). */
export function setSoundTimingCorrection(ms: number): void {
  timingCorrectionMs = ms;
}

/** How much earlier than their beat clicks must be queued, ms. */
export function soundLeadMs(): number {
  return Math.max(0, timingCorrectionMs);
}

let engine: Promise<AudioEngine> | null = null;
let ready: AudioEngine | null = null;

/** Loads Tone.js ahead of time (no sound, no permission needed). */
export function preloadAudio(): void {
  void import('tone');
}

export function startAudio(): Promise<AudioEngine> {
  engine ??= createEngine().then((created) => (ready = created));
  return engine;
}

/** The engine if it has already started, without waiting. */
export function audioIfReady(): AudioEngine | null {
  return ready;
}

async function createEngine(): Promise<AudioEngine> {
  const Tone = await import('tone');
  // Hand Tone a native context: its own wrapper hides getOutputTimestamp/outputLatency,
  // which we need to line clicks up with the screen.
  const context = new AudioContext({ latencyHint: 'interactive' });
  Tone.setContext(context);
  await Tone.start();

  const click = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
  }).toDestination();

  // A simple synthesized piano: bright attack, decaying tone. (Sampled piano: later.)
  const piano = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.45, 0.25, 0.12, 0.08] },
    envelope: { attack: 0.004, decay: 1.6, sustain: 0.08, release: 0.6 },
  }).toDestination();
  // Autoplay and the other hand: the same sound on its own synth, so stopping it doesn't cut
  // the learner's own notes. Its notes play a little softer.
  const accompanist = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.45, 0.25, 0.12, 0.08] },
    envelope: { attack: 0.004, decay: 1.6, sustain: 0.08, release: 0.6 },
  }).toDestination();
  const applyVolumes = ({ metronome, piano: pianoVolume }: Volumes) => {
    click.volume.value = CLICK_FULL_DB + volumeDb(metronome);
    piano.volume.value = PIANO_FULL_DB + volumeDb(pianoVolume);
    accompanist.volume.value = PIANO_FULL_DB + volumeDb(pianoVolume);
  };
  applyVolumes(volumes);
  const noteName = (midi: number) => Tone.Frequency(midi, 'midi').toNote();

  let lastClick = 0;
  return {
    setVolumes: applyVolumes,
    outputDelayMs() {
      return (context.baseLatency + (context.outputLatency || 0)) * 1000;
    },
    noteOn(midi, velocity) {
      piano.triggerAttack(noteName(midi), context.currentTime, velocity / 127);
    },
    noteOff(midi) {
      piano.triggerRelease(noteName(midi), context.currentTime);
    },
    accompany(midi, start, end, velocity = 0.7) {
      const from = audioTimeFor(context, start - timingCorrectionMs);
      if (from < context.currentTime - MAX_LATE_NOTE_S) return;
      const when = Math.max(from, context.currentTime);
      const until = audioTimeFor(context, end - timingCorrectionMs);
      accompanist.triggerAttackRelease(
        noteName(midi),
        Math.max(0.05, until - when),
        when,
        velocity,
      );
    },
    stopAccompaniment() {
      accompanist.releaseAll();
    },
    click(time, accent) {
      const target = audioTimeFor(context, time - timingCorrectionMs);
      // A click that's already noticeably late (e.g. timers throttled in a background tab)
      // would only confuse; skip it rather than play it off the beat. Its time is on the
      // speakers' timeline, which runs behind by the output delay: that much late still plays.
      const outputDelay = context.baseLatency + (context.outputLatency || 0);
      if (target < context.currentTime - outputDelay - MAX_LATE_S) return;
      // Tone requires strictly increasing start times for the same synth.
      const when = Math.max(target, context.currentTime, lastClick + 0.001);
      lastClick = when;
      click.triggerAttackRelease(accent ? ACCENT_CLICK : BEAT_CLICK, 0.03, when);
    },
  };
}

function audioTimeFor(context: AudioContext, time: number): number {
  if (typeof context.getOutputTimestamp === 'function') {
    const { contextTime, performanceTime } = context.getOutputTimestamp();
    if (contextTime !== undefined && performanceTime) {
      return contextTime + (time - performanceTime) / 1000;
    }
  }
  const latency = context.outputLatency || context.baseLatency || 0;
  return context.currentTime - latency + (time - performance.now()) / 1000;
}
