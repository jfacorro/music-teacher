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
  /** Single reference notes the score is based on (notes played together are left out). */
  reference: number;
  /** Reference notes played together with another (chords): not scored, since the
   *  microphone detects one note at a time. */
  together: number;
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
export const PAIRING_WINDOW = { earlyMs: 150, lateMs: 250 };

/** Reference notes this close to another one count as played together. */
const TOGETHER_MS = 60;

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
 * Pairs reference notes with detections inside the pairing window: first same-key pairs,
 * closest first, then whatever is left (any key, closest first), so one missed note can't
 * take the next note's detection and set off a chain of wrong pairings.
 */
export function pairNotes(
  reference: readonly TimedNote[],
  detected: readonly TimedNote[],
  window = PAIRING_WINDOW,
): { pairs: NotePair[]; unpairedReference: TimedNote[]; unpairedDetected: TimedNote[] } {
  const refsLeft = new Set(reference);
  const detsLeft = new Set(detected);
  const pairs: NotePair[] = [];

  const pass = (accept: (ref: TimedNote, det: TimedNote) => boolean) => {
    const candidates: NotePair[] = [];
    for (const ref of refsLeft) {
      for (const det of detsLeft) {
        const offsetMs = det.time - ref.time;
        if (offsetMs < -window.earlyMs || offsetMs > window.lateMs || !accept(ref, det)) continue;
        candidates.push({ reference: ref, detected: det, offsetMs });
      }
    }
    candidates.sort((a, b) => Math.abs(a.offsetMs) - Math.abs(b.offsetMs));
    for (const candidate of candidates) {
      if (!refsLeft.has(candidate.reference) || !detsLeft.has(candidate.detected)) continue;
      refsLeft.delete(candidate.reference);
      detsLeft.delete(candidate.detected);
      pairs.push(candidate);
    }
  };
  pass((ref, det) => ref.pitch !== null && ref.pitch === det.pitch);
  pass(() => true);

  const byTime = (a: TimedNote, b: TimedNote) => a.time - b.time;
  pairs.sort((a, b) => byTime(a.reference, b.reference));
  return {
    pairs,
    unpairedReference: [...refsLeft].sort(byTime),
    unpairedDetected: [...detsLeft].sort(byTime),
  };
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
  // Pair against every reference, so detections of chord notes aren't counted as extra,
  // then score only the single notes.
  const together = new Set(
    reference.filter((note) =>
      reference.some((other) => other !== note && Math.abs(other.time - note.time) <= TOGETHER_MS),
    ),
  );
  const all = pairNotes(reference, detected);
  const pairs = all.pairs.filter((p) => !together.has(p.reference));
  const unpairedReference = all.unpairedReference.filter((note) => !together.has(note));
  const unpairedDetected = all.unpairedDetected;
  const scored = reference.length - together.size;

  const correct = pairs.filter((p) => p.detected.pitch === p.reference.pitch);
  const octaveErrors = pairs.filter(
    (p) =>
      p.detected.pitch !== p.reference.pitch &&
      p.detected.pitch !== null &&
      p.reference.pitch !== null &&
      Math.abs(p.detected.pitch - p.reference.pitch) % 12 === 0,
  ).length;
  return {
    reference: scored,
    together: together.size,
    detected: detected.length,
    correct: correct.length,
    octaveErrors,
    wrongPitch: pairs.length - correct.length - octaveErrors,
    missed: unpairedReference.length,
    extra: unpairedDetected.length,
    accuracy: scored === 0 ? 0 : correct.length / scored,
    ...delayOf(correct),
  };
}
