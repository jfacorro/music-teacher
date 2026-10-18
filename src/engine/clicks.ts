/** Which metronome clicks fall in a stretch of playback (count-in and/or every beat). */

export interface Click {
  beat: number;
  /** First beat of a measure (or of the count-in). */
  accent: boolean;
}

export interface ClickOptions {
  /** Click on every beat of the music (beat ≥ 0). */
  metronome: boolean;
  /** Count-in starts here (e.g. -4 in 4/4), or null for none. Clicks run up to `musicStart`. */
  countInFrom: number | null;
  /** Where the count-in ends and the music starts: 0, or the first beat of a loop. */
  musicStart?: number;
  /** When looping, playback jumps back here to the loop's start: no clicks from here on. */
  loopEnd?: number | null;
  /**
   * Wait mode: the music stops at this beat until its notes are played. Its click marks when
   * they're due; none comes after it until the music moves on.
   */
  holdBeat?: number;
  beatsPerMeasure: number;
}

/** Whole beats in (from, to] that should click. */
export function clicksBetween(from: number, to: number, options: ClickOptions): Click[] {
  const { countInFrom, musicStart = 0, loopEnd = null } = options;
  const clicks: Click[] = [];
  for (let beat = Math.floor(from) + 1; beat <= to; beat++) {
    if (loopEnd !== null && beat >= loopEnd) break;
    if (countInFrom !== null && beat >= countInFrom && beat < musicStart) {
      clicks.push({ beat, accent: isMultiple(beat - countInFrom, options.beatsPerMeasure) });
    } else if (beat >= 0 && options.metronome) {
      clicks.push({ beat, accent: isMultiple(beat, options.beatsPerMeasure) });
    }
  }
  return clicks;
}

function isMultiple(value: number, of: number): boolean {
  return Math.abs(value / of - Math.round(value / of)) < 1e-9;
}
