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

export interface AudioEngine {
  /** Metronome click heard at `time` (performance.now() ms). */
  click(time: number, accent: boolean): void;
  /** Piano-like note, right now. */
  noteOn(midi: number, velocity: number): void;
  noteOff(midi: number): void;
  /** Time from playing a sound to hearing it, as reported by the browser, ms. */
  outputDelayMs(): number;
}

const MAX_LATE_S = 0.03;

let timingCorrectionMs = 0;

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
    volume: -8,
  }).toDestination();

  // A simple synthesized piano: bright attack, decaying tone. (Sampled piano: later.)
  const piano = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.45, 0.25, 0.12, 0.08] },
    envelope: { attack: 0.004, decay: 1.6, sustain: 0.08, release: 0.6 },
    volume: -12,
  }).toDestination();
  const noteName = (midi: number) => Tone.Frequency(midi, 'midi').toNote();

  let lastClick = 0;
  return {
    outputDelayMs() {
      return (context.baseLatency + (context.outputLatency || 0)) * 1000;
    },
    noteOn(midi, velocity) {
      piano.triggerAttack(noteName(midi), context.currentTime, velocity / 127);
    },
    noteOff(midi) {
      piano.triggerRelease(noteName(midi), context.currentTime);
    },
    click(time, accent) {
      const target = audioTimeFor(context, time - timingCorrectionMs);
      // A click that's already noticeably late (e.g. timers throttled in a background tab)
      // would only confuse; skip it rather than play it off the beat.
      if (target < context.currentTime - MAX_LATE_S) return;
      // Tone requires strictly increasing start times for the same synth.
      const when = Math.max(target, context.currentTime, lastClick + 0.001);
      lastClick = when;
      click.triggerAttackRelease(accent ? 'E6' : 'A5', 0.03, when);
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
