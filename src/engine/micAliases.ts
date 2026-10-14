/**
 * Pitch differences (detected − expected) the microphone tends to confuse: octaves, and the
 * octave plus a fifth (the strong third harmonic of piano tones). Near an expected note, a
 * microphone note at one of these distances counts as that note (PLAN.md §12).
 */
import type { InputSourceKind } from '../input/types';

export const MIC_ALIASES: readonly number[] = [12, -12, 24, -24, 19];

/**
 * The expected pitch a played key counts as: itself if expected; for the microphone, an
 * expected pitch it's easily confused with; otherwise the played pitch unchanged.
 */
export function resolvePlayed(
  played: number,
  source: InputSourceKind,
  expected: readonly number[],
): number {
  if (source !== 'mic' || expected.includes(played)) return played;
  return expected.find((pitch) => MIC_ALIASES.includes(played - pitch)) ?? played;
}
