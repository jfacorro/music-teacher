/**
 * Calibration math (PLAN.md §5.4): background noise level, input delay, and how well the
 * microphone agrees with a reference (MIDI from the same keyboard, or metronome clicks).
 */

export interface TimedNote {
  /** ms, performance.now() timeline */
  time: number;
  /** MIDI number; null for references without a pitch (metronome clicks). */
  pitch: number | null;
}

export interface NotePair {
  reference: TimedNote;
  detected: TimedNote;
  /** detected − reference, ms */
  offsetMs: number;
}

export interface Comparison {
  reference: number;
  detected: number;
  /** Paired and the same key. */
  correct: number;
  /** Paired, right note name but wrong octave (a common pitch-detection error). */
  octaveErrors: number;
  /** Paired with a different key. */
  wrongPitch: number;
  /** Reference notes the microphone didn't hear. */
  missed: number;
  /** Detections with no reference note (noise, echoes, other sounds). */
  extra: number;
  /** Share of reference notes detected as the right key. */
  accuracy: number;
  /** Median delay of correct detections, ms; null without any. */
  latencyMs: number | null;
  /** Median absolute deviation of that delay, ms: how steady the timing is. */
  jitterMs: number | null;
}

/** How far a detection may be from its reference (the microphone is never much early). */
export const PAIRING_WINDOW = { earlyMs: 100, lateMs: 400 };

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

/** Background level from a few seconds of quiet: the 90th percentile of hop levels. */
export function noiseFloorFrom(levelsDb: readonly number[]): number | null {
  return percentile(
    levelsDb.filter((level) => Number.isFinite(level)),
    90,
  );
}

/**
 * Pairs each reference note, in time order, with the nearest unused detection inside the
 * pairing window, preferring the same key when the reference has a pitch.
 */
export function pairNotes(
  reference: readonly TimedNote[],
  detected: readonly TimedNote[],
  window = PAIRING_WINDOW,
): { pairs: NotePair[]; unpairedReference: TimedNote[]; unpairedDetected: TimedNote[] } {
  const available = [...detected].sort((a, b) => a.time - b.time);
  const pairs: NotePair[] = [];
  const unpairedReference: TimedNote[] = [];

  for (const ref of [...reference].sort((a, b) => a.time - b.time)) {
    const inWindow = available.filter(
      (d) => d.time - ref.time >= -window.earlyMs && d.time - ref.time <= window.lateMs,
    );
    const samePitch = ref.pitch === null ? [] : inWindow.filter((d) => d.pitch === ref.pitch);
    const pool = samePitch.length > 0 ? samePitch : inWindow;
    const best = pool.sort((a, b) => Math.abs(a.time - ref.time) - Math.abs(b.time - ref.time))[0];
    if (!best) {
      unpairedReference.push(ref);
      continue;
    }
    available.splice(available.indexOf(best), 1);
    pairs.push({ reference: ref, detected: best, offsetMs: best.time - ref.time });
  }
  return { pairs, unpairedReference, unpairedDetected: available };
}

/** Delay (median offset) and steadiness (median absolute deviation) of paired notes. */
export function delayOf(pairs: readonly NotePair[]): {
  latencyMs: number | null;
  jitterMs: number | null;
} {
  const offsets = pairs.map((pair) => pair.offsetMs);
  const latencyMs = median(offsets);
  if (latencyMs === null) return { latencyMs: null, jitterMs: null };
  return { latencyMs, jitterMs: median(offsets.map((offset) => Math.abs(offset - latencyMs))) };
}

/** Microphone detections compared with reference notes (e.g. MIDI from the same keys). */
export function compare(
  reference: readonly TimedNote[],
  detected: readonly TimedNote[],
): Comparison {
  const { pairs, unpairedReference, unpairedDetected } = pairNotes(reference, detected);
  const correct = pairs.filter((p) => p.detected.pitch === p.reference.pitch);
  const octaveErrors = pairs.filter(
    (p) =>
      p.detected.pitch !== p.reference.pitch &&
      p.detected.pitch !== null &&
      p.reference.pitch !== null &&
      Math.abs(p.detected.pitch - p.reference.pitch) % 12 === 0,
  ).length;
  return {
    reference: reference.length,
    detected: detected.length,
    correct: correct.length,
    octaveErrors,
    wrongPitch: pairs.length - correct.length - octaveErrors,
    missed: unpairedReference.length,
    extra: unpairedDetected.length,
    accuracy: reference.length === 0 ? 0 : correct.length / reference.length,
    ...delayOf(correct),
  };
}
