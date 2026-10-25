/**
 * Singing back what was heard (PLAN.md milestone 6.4), the voice's answer in ear training: the
 * notes of a question, sung one after another from the microphone's pitch readings. A note is
 * found once it's held in tune (within `MATCH_CENTS`, any octave) for `WAIT_HOLD_MS`, as when a
 * sung melody waits; a different note held steadily for `WRONG_HOLD_MS` is a wrong answer (said
 * once, until the voice moves to another note). Still holding the note just found, or sliding
 * through notes on the way, doesn't count against it.
 */
import { centsFrom, MATCH_CENTS } from './matchNote';
import { WAIT_HOLD_MS } from './singing';
import { HeldNote } from './vocalRange';

/** A different note held this long is a wrong answer, ms: longer than finding one, so slides pass. */
export const WRONG_HOLD_MS = 600;

export interface SingBackUpdate {
  /** How far into holding the note due (0–1). */
  held: number;
  /** The note due was just found (its index). */
  found: number | null;
  /** A wrong note was just held (the nearest MIDI number sung). */
  wrong: number | null;
}

export class SingBack {
  readonly notes: readonly number[];
  private index = 0;
  private find = new HeldNote(WAIT_HOLD_MS);
  private other = new HeldNote(WRONG_HOLD_MS);
  /** The wrong note already said, until the voice moves on from it. */
  private judged: number | null = null;

  constructor(notes: readonly number[]) {
    this.notes = notes;
  }

  /** How many notes were found so far. */
  get sung(): number {
    return this.index;
  }

  get finished(): boolean {
    return this.index >= this.notes.length;
  }

  /** The note due, if any. */
  get current(): number | undefined {
    return this.notes[this.index];
  }

  /** A reading at `time` (ms): the exact pitch in semitones, or null when nothing clear is heard. */
  update(pitch: number | null, time: number): SingBackUpdate {
    const target = this.current;
    if (target === undefined) return { held: 0, found: null, wrong: null };
    const near = (note: number | undefined) =>
      pitch !== null && note !== undefined && Math.abs(centsFrom(note, pitch)) <= MATCH_CENTS;
    const tuned = near(target);
    // Out of tune breaks the hold (-1), as when waiting for a sung note.
    const { note: holding, held } = this.find.update(
      pitch === null ? null : tuned ? target : -1,
      time,
    );
    const progress = holding === target ? held : 0;
    if (progress >= 1) {
      this.index++;
      this.reset();
      return { held: 1, found: this.index - 1, wrong: null };
    }
    // Any other note, but not the one just found, held on.
    const elsewhere = pitch !== null && !tuned && !near(this.notes[this.index - 1]);
    const other = this.other.update(elsewhere ? Math.round(pitch) : null, time);
    if (other.note !== this.judged) this.judged = null;
    if (other.note !== null && other.held >= 1 && this.judged === null) {
      this.judged = other.note;
      return { held: progress, found: null, wrong: other.note };
    }
    return { held: progress, found: null, wrong: null };
  }

  /** Moves on without the note due (e.g. skipped). */
  skip(): void {
    if (!this.finished) this.index++;
    this.reset();
  }

  private reset(): void {
    this.find = new HeldNote(WAIT_HOLD_MS);
    this.other = new HeldNote(WRONG_HOLD_MS);
    this.judged = null;
  }
}
