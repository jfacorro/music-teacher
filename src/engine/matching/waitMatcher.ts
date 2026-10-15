/**
 * Wait mode matching (PLAN.md §6.2): notes are grouped by start time; the music waits at each
 * group until all of its keys are pressed, either within the chord tolerance of each other or
 * held down together. Wrong keys are flagged but don't advance.
 */
import type { ScoreNote } from '../score';

export interface NoteGroup {
  start: number;
  notes: ScoreNote[];
}

export type WaitResult =
  { kind: 'correct'; note: ScoreNote; groupComplete: boolean } | { kind: 'wrong'; pitch: number };

export function groupByStart(notes: readonly ScoreNote[]): NoteGroup[] {
  const groups: NoteGroup[] = [];
  for (const note of [...notes].sort((a, b) => a.start - b.start)) {
    const last = groups.at(-1);
    if (last && Math.abs(last.start - note.start) < 1e-9) {
      if (!last.notes.some((n) => n.pitch.midi === note.pitch.midi)) last.notes.push(note);
    } else {
      groups.push({ start: note.start, notes: [note] });
    }
  }
  return groups;
}

export class WaitMatcher {
  readonly groups: NoteGroup[];
  private index = 0;
  /** Press time of each key pressed since the current group became current. */
  private presses = new Map<number, number>();
  private held = new Set<number>();

  constructor(notes: readonly ScoreNote[]) {
    this.groups = groupByStart(notes);
  }

  get current(): NoteGroup | undefined {
    return this.groups[this.index];
  }

  /** The current group's notes whose keys aren't down: what still has to be played. */
  get missing(): ScoreNote[] {
    return this.current?.notes.filter((note) => !this.held.has(note.pitch.midi)) ?? [];
  }

  get done(): boolean {
    return this.index >= this.groups.length;
  }

  /**
   * @param anyNote any key of the group completes it (the microphone hears one note at a
   *   time, so it can't check whole chords)
   */
  press(pitch: number, time: number, chordToleranceMs: number, anyNote = false): WaitResult {
    this.held.add(pitch);
    const group = this.current;
    const note = group?.notes.find((n) => n.pitch.midi === pitch);
    if (!group || !note) return { kind: 'wrong', pitch };

    this.presses.set(pitch, time);
    const complete = anyNote || this.isSatisfied(group, chordToleranceMs);
    if (complete) {
      this.index++;
      this.presses.clear();
    }
    return { kind: 'correct', note, groupComplete: complete };
  }

  release(pitch: number): void {
    this.held.delete(pitch);
  }

  private isSatisfied(group: NoteGroup, chordToleranceMs: number): boolean {
    const times: number[] = [];
    for (const note of group.notes) {
      const time = this.presses.get(note.pitch.midi);
      if (time === undefined) return false;
      times.push(time);
    }
    const together = Math.max(...times) - Math.min(...times) <= chordToleranceMs;
    const allHeld = group.notes.every((note) => this.held.has(note.pitch.midi));
    return together || allHeld;
  }
}
