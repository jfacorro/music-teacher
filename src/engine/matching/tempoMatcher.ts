/**
 * Tempo mode matching (PLAN.md §6.2): each played Note On is matched to the nearest unmatched
 * expected note of the same pitch within the timing window. Unmatched played notes are extra;
 * expected notes whose window has passed are missed.
 */
import { beatsToMs, type ScoreNote } from '../score';
import { gradeFor, type Grade, type TimingWindows } from '../timing';

export type TempoResult =
  | { kind: 'hit'; note: ScoreNote; grade: Grade; errorMs: number }
  | { kind: 'extra'; pitch: number; beat: number };

export class TempoMatcher {
  private pending: ScoreNote[];

  constructor(notes: readonly ScoreNote[]) {
    this.pending = [...notes];
  }

  get done(): boolean {
    return this.pending.length === 0;
  }

  /** A key was pressed at `beat` while playing at `tempo`. */
  play(pitch: number, beat: number, tempo: number, windows: TimingWindows): TempoResult {
    let best: { note: ScoreNote; errorMs: number } | undefined;
    for (const note of this.pending) {
      if (note.pitch.midi !== pitch) continue;
      const errorMs = beatsToMs(beat - note.start, tempo);
      if (Math.abs(errorMs) > windows.ok) continue;
      if (!best || Math.abs(errorMs) < Math.abs(best.errorMs)) best = { note, errorMs };
    }
    if (!best) return { kind: 'extra', pitch, beat };

    this.pending = this.pending.filter((note) => note !== best.note);
    const grade = gradeFor(best.errorMs, windows) as Grade;
    return { kind: 'hit', note: best.note, grade, errorMs: best.errorMs };
  }

  /** Notes still waiting to be played whose window includes `beat`. */
  candidates(beat: number, tempo: number, windows: TimingWindows): ScoreNote[] {
    return this.pending.filter(
      (note) => Math.abs(beatsToMs(beat - note.start, tempo)) <= windows.ok,
    );
  }

  /** The notes to play next: those in their window now, else the next ones still to come. */
  upcoming(beat: number, tempo: number, windows: TimingWindows): ScoreNote[] {
    const now = this.candidates(beat, tempo, windows);
    if (now.length > 0) return now;
    const later = this.pending.filter((note) => note.start > beat);
    const next = Math.min(...later.map((note) => note.start));
    return later.filter((note) => note.start === next);
  }

  /** Time moved on to `beat`: returns the notes that can no longer be hit. */
  advance(beat: number, tempo: number, windows: TimingWindows): ScoreNote[] {
    const missed = this.pending.filter((note) => beatsToMs(beat - note.start, tempo) > windows.ok);
    if (missed.length > 0) this.pending = this.pending.filter((note) => !missed.includes(note));
    return missed;
  }
}
