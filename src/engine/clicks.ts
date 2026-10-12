/** Which metronome clicks fall in a stretch of playback (count-in and/or every beat). */

export interface Click {
  beat: number;
  /** First beat of a measure (or of the count-in). */
  accent: boolean;
}

export interface ClickOptions {
  /** Click on every beat of the music (beat ≥ 0). */
  metronome: boolean;
  /** Count-in starts here (e.g. -4 in 4/4), or null for none. Clicks run up to beat 0. */
  countInFrom: number | null;
  beatsPerMeasure: number;
}

/** Whole beats in (from, to] that should click. */
export function clicksBetween(from: number, to: number, options: ClickOptions): Click[] {
  const clicks: Click[] = [];
  for (let beat = Math.floor(from) + 1; beat <= to; beat++) {
    if (beat < 0) {
      if (options.countInFrom === null || beat < options.countInFrom) continue;
      clicks.push({
        beat,
        accent: isMultiple(beat - options.countInFrom, options.beatsPerMeasure),
      });
    } else if (options.metronome) {
      clicks.push({ beat, accent: isMultiple(beat, options.beatsPerMeasure) });
    }
  }
  return clicks;
}

function isMultiple(value: number, of: number): boolean {
  return Math.abs(value / of - Math.round(value / of)) < 1e-9;
}
