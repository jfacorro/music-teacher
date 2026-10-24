/**
 * Match the note (PLAN.md milestone 6.1), on the Tuner page: the app plays a note from the
 * singer's range, and they sing it back and hold it in tune, in any octave.
 */
import { pitchFromMidi } from '../theory/pitch';
import { quizCards } from './quiz';
import { accuracyOf, starsFor } from './scoring';
import { IN_TUNE_CENTS } from './tuner';
import { HeldNote } from './vocalRange';

/** Notes in a run. */
export const MATCH_NOTES = 10;
/** Close enough to count: within this many cents of the note, in any octave. */
export const MATCH_CENTS = 50;
/**
 * A note counts when it's matched within this long of being heard (ms). Later it still moves on,
 * without counting.
 */
export const MATCH_WITHIN_MS = 6000;
/** Notes this close to either end of the range are left out when it's wide enough to spare them. */
const EDGE = 2;

/** The notes of a run: from the range, short of its ends, each as evenly as possible. */
export function matchTargets(
  range: { low: number; high: number },
  count = MATCH_NOTES,
  random: () => number = Math.random,
): number[] {
  const edge = range.high - range.low >= 12 + 2 * EDGE ? EDGE : 0;
  const notes = [];
  for (let midi = range.low + edge; midi <= range.high - edge; midi++) {
    notes.push(pitchFromMidi(midi));
  }
  return quizCards(notes, count, random).map((pitch) => pitch.midi);
}

/**
 * The notes of a lesson's run: those up to `within` semitones either side of the comfortable note,
 * kept inside the range, each as evenly as possible.
 */
export function matchTargetsNear(
  range: { low: number; high: number; comfortable: number },
  within: number,
  count = MATCH_NOTES,
  random: () => number = Math.random,
): number[] {
  const notes = [];
  const low = Math.max(range.low, range.comfortable - within);
  const high = Math.min(range.high, range.comfortable + within);
  for (let midi = low; midi <= high; midi++) notes.push(pitchFromMidi(midi));
  return quizCards(notes, count, random).map((pitch) => pitch.midi);
}

/** How far `pitch` (in semitones, exact) is from the nearest octave of `target`, in cents. */
export function centsFrom(target: number, pitch: number): number {
  const cents = Math.round((pitch - target) * 100);
  return cents - 1200 * Math.round(cents / 1200);
}

/** How one note went. */
export interface NoteMatch {
  target: number;
  /** Matched within `MATCH_WITHIN_MS` of being heard. */
  inTime: boolean;
  /**
   * How far off on average, in cents: while it was held, or over all that was sung when it never
   * was. Null when nothing was heard.
   */
  offset: number | null;
}

/** Follows the singing for one note: how far into holding it in tune, and how far off. */
export class NoteMatcher {
  private readonly hold = new HeldNote();
  private listeningFrom = 0;
  private matchedAt: number | null = null;
  /** Cents off, of everything sung, and of the hold under way. */
  private readonly sung: number[] = [];
  private holding: number[] = [];
  readonly target: number;

  constructor(target: number) {
    this.target = target;
  }

  /** The note was heard (again) at `time` (ms): the time to match it starts over. */
  listen(time: number): void {
    this.listeningFrom = time;
  }

  /**
   * A reading at `time` (ms): the exact pitch, or null when nothing clear is heard. Returns how
   * far into holding the note in tune (0–1; 1 = matched).
   */
  update(pitch: number | null, time: number): number {
    if (this.matchedAt !== null) return 1;
    if (pitch === null) {
      const { note, held } = this.hold.update(null, time);
      return note === this.target ? held : 0;
    }
    const cents = centsFrom(this.target, pitch);
    this.sung.push(cents);
    if (Math.abs(cents) > MATCH_CENTS) {
      this.hold.update(Math.round(pitch), time);
      return 0;
    }
    const { held } = this.hold.update(this.target, time);
    if (held === 0) this.holding = [];
    this.holding.push(cents);
    if (held >= 1) this.matchedAt = time;
    return held;
  }

  get matched(): boolean {
    return this.matchedAt !== null;
  }

  /** Whether it's still in time to count, at `time` (ms). */
  inTime(time: number): boolean {
    return (this.matchedAt ?? time) - this.listeningFrom <= MATCH_WITHIN_MS;
  }

  result(): NoteMatch {
    const counted = this.matched ? this.holding : this.sung;
    return {
      target: this.target,
      inTime: this.matched && this.inTime(this.matchedAt!),
      offset: counted.length === 0 ? null : Math.round(average(counted)),
    };
  }
}

const average = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export interface MatchSummary {
  /** Notes matched in time. */
  matched: number;
  total: number;
  accuracy: number;
  stars: 0 | 1 | 2 | 3;
  /**
   * The notes to work on, each once, low to high: not matched in time, or held outside the
   * tuner's in-tune zone. Their offset says whether they went flat or sharp.
   */
  toWorkOn: NoteMatch[];
}

export function matchSummary(notes: readonly NoteMatch[]): MatchSummary {
  const matched = notes.filter((note) => note.inTime).length;
  const accuracy = accuracyOf(matched, 0, notes.length);
  const byTarget = new Map<number, NoteMatch[]>();
  for (const note of notes) byTarget.set(note.target, [...(byTarget.get(note.target) ?? []), note]);
  const toWorkOn = [...byTarget]
    .map(([target, tries]): NoteMatch => {
      const offsets = tries.flatMap((note) => (note.offset === null ? [] : [note.offset]));
      return {
        target,
        inTime: tries.every((note) => note.inTime),
        offset: offsets.length === 0 ? null : Math.round(average(offsets)),
      };
    })
    .filter((note) => !note.inTime || Math.abs(note.offset ?? 0) > IN_TUNE_CENTS)
    .sort((a, b) => a.target - b.target);
  return { matched, total: notes.length, accuracy, stars: starsFor(accuracy), toWorkOn };
}
