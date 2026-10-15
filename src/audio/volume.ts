/**
 * Volume sliders (0–100 %) in decibels. Halving the slider is about 12 dB quieter, which
 * sounds roughly half as loud; 0 is silent.
 */

export interface Volumes {
  /** Metronome clicks, %. */
  metronome: number;
  /** The app's piano: autoplay, the other hand, and keys played on the computer or screen, %. */
  piano: number;
}

export const VOLUME_MAX = 100;

/** The default balance: the click sits clearly under the music. */
export const DEFAULT_VOLUMES: Volumes = { metronome: 50, piano: 70 };

/** Decibels to add to a sound's full level (0 at 100 %). */
export function volumeDb(percent: number): number {
  if (percent <= 0) return -Infinity;
  return 40 * Math.log10(Math.min(percent, VOLUME_MAX) / VOLUME_MAX);
}
