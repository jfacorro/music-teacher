/**
 * Recording a practice run (PLAN.md milestone 4.2): the keys played, placed on the music's
 * timeline (beats), to listen back in time with the music and to compare with the written notes.
 *
 * Keys keep where they were played on that timeline: in tempo mode early or late; in wait mode
 * ahead of their note, or on it when the music waited for them.
 */
import { InputSource } from '../input/types';
import { TempoMatcher, TempoResultKind } from './matching/tempoMatcher';
import { WaitMatcher, WaitResultKind } from './matching/waitMatcher';
import { beatsToMs, msToBeats, type ScoreNote } from './score';
import { HandFilter } from './session';
import { chordToleranceFor, Timing, timingOf, type TimingWindows, windowsFor } from './timing';

export interface RecordedNote {
  pitch: number;
  /** How hard it was played, 1–127 (measured on a MIDI keyboard, estimated by the microphone). */
  velocity: number;
  source: InputSource;
  /** When it was pressed and released, in beats on the music's timeline. */
  start: number;
  end: number;
}

export interface Recording {
  /** Sorted by start, then pitch. */
  notes: RecordedNote[];
  /** The tempo it was played at (quarter notes per minute). */
  tempo: number;
  /** The hands practiced. */
  hands: HandFilter;
  /** The stretch of music the run covered, beats. */
  from: number;
  to: number;
  /** Tempo mode: the windows for calling a note early or late; null in wait mode. */
  windows: TimingWindows | null;
}

/** Collects the keys pressed and released during a run into notes. */
export class Recorder {
  private readonly held = new Map<number, RecordedNote>();
  private readonly notes: RecordedNote[] = [];

  press(pitch: number, velocity: number, source: InputSource, beat: number): void {
    this.release(pitch, beat);
    const note = { pitch, velocity, source, start: beat, end: beat };
    this.held.set(pitch, note);
    this.notes.push(note);
  }

  release(pitch: number, beat: number): void {
    const note = this.held.get(pitch);
    if (!note) return;
    note.end = Math.max(note.start, beat);
    this.held.delete(pitch);
  }

  /** The notes played; keys still down end at `beat`. */
  finish(beat: number): RecordedNote[] {
    for (const pitch of [...this.held.keys()]) this.release(pitch, beat);
    return this.notes
      .map((note) => ({ ...note }))
      .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  }
}

export const PlayedVerdict = {
  /** Wait mode: the right key. */
  Correct: 'correct',
  OnTime: 'onTime',
  Early: 'early',
  Late: 'late',
  /** No written note on that key around then. */
  Wrong: 'wrong',
  /** A key of a note not practiced (the other hand, other bars), or before the music started. */
  Ungraded: 'ungraded',
} as const;
export type PlayedVerdict = (typeof PlayedVerdict)[keyof typeof PlayedVerdict];

export interface ComparedNote extends RecordedNote {
  verdict: PlayedVerdict;
}

export interface Comparison {
  /** The written notes the run was graded on (see `writtenFor`). */
  written: ScoreNote[];
  played: ComparedNote[];
  /** Written notes no key was played for. */
  missed: ScoreNote[];
}

const TIMING_VERDICT: Readonly<Record<Timing, PlayedVerdict>> = {
  [Timing.Early]: PlayedVerdict.Early,
  [Timing.OnTime]: PlayedVerdict.OnTime,
  [Timing.Late]: PlayedVerdict.Late,
};

/**
 * Says how each played key went, graded the way the run was (see PracticeSession): in tempo
 * mode, each key against the nearest written note on it within the timing windows; in wait
 * mode, against the notes the music was waiting for, in order.
 */
export function compareRun(notes: readonly ScoreNote[], recording: Recording): Comparison {
  const written = writtenFor(notes, recording);
  const practiced = new Set(written);
  const source = recording.notes[0]?.source ?? InputSource.Midi;
  const slack = msToBeats(windowsFor(source).ok, recording.tempo);
  // A key of a note not practiced, around when it's written, isn't wrong.
  const ungraded = (played: RecordedNote) =>
    notes.some(
      (note) =>
        !practiced.has(note) &&
        note.pitch.midi === played.pitch &&
        played.start >= note.start - slack &&
        played.start <= note.start + note.duration + slack,
    );

  const { verdicts, matched } = recording.windows
    ? gradeTempo(written, recording, recording.windows)
    : gradeWait(written, recording);
  const played = recording.notes.map((note, i): ComparedNote => {
    const verdict = verdicts[i] ?? PlayedVerdict.Wrong;
    return {
      ...note,
      verdict: verdict === PlayedVerdict.Wrong && ungraded(note) ? PlayedVerdict.Ungraded : verdict,
    };
  });
  return { written, played, missed: written.filter((note) => !matched.has(note)) };
}

interface Grading {
  /** Per recorded note. */
  verdicts: PlayedVerdict[];
  /** The written notes played. */
  matched: Set<ScoreNote>;
}

function gradeTempo(
  written: readonly ScoreNote[],
  { notes, tempo, from }: Recording,
  windows: TimingWindows,
): Grading {
  const matcher = new TempoMatcher(written);
  const matched = new Set<ScoreNote>();
  const verdicts = notes.map((note) => {
    // Playing around before the music starts (the count-in) isn't graded.
    if (note.start < from - msToBeats(windows.ok, tempo)) return PlayedVerdict.Ungraded;
    const result = matcher.play(note.pitch, note.start, tempo, windows);
    if (result.kind === TempoResultKind.Extra) return PlayedVerdict.Wrong;
    matched.add(result.note);
    // The microphone hears one key of a chord for all of it.
    if (note.source === InputSource.Mic) {
      for (const other of matcher.takeChord(result.note)) matched.add(other);
    }
    return TIMING_VERDICT[timingOf(result.errorMs, windows)];
  });
  return { verdicts, matched };
}

function gradeWait(written: readonly ScoreNote[], { notes, tempo }: Recording): Grading {
  const matcher = new WaitMatcher(written);
  const matched = new Set<ScoreNote>();
  const verdicts: PlayedVerdict[] = [];
  // Presses and releases as they happened; a key's own release comes after its press.
  const events = notes
    .flatMap((note, index) => [
      { beat: note.start, note, index, press: true },
      { beat: note.end, note, index, press: false },
    ])
    .sort((a, b) => a.beat - b.beat || a.index - b.index || Number(b.press) - Number(a.press));
  for (const { note, index, press } of events) {
    if (!press) {
      matcher.release(note.pitch);
      continue;
    }
    const group = matcher.current;
    const result = matcher.press(
      note.pitch,
      beatsToMs(note.start, tempo),
      chordToleranceFor(note.source),
      note.source === InputSource.Mic,
    );
    if (result.kind === WaitResultKind.Wrong) {
      verdicts[index] = PlayedVerdict.Wrong;
      continue;
    }
    verdicts[index] = PlayedVerdict.Correct;
    if (result.groupComplete && group) for (const done of group.notes) matched.add(done);
  }
  return { verdicts, matched };
}

/** The written notes a recording is compared with: its hands, within the stretch it covered. */
export function writtenFor(notes: readonly ScoreNote[], recording: Recording): ScoreNote[] {
  return notes.filter(
    (note) =>
      (recording.hands === HandFilter.Both || note.hand === recording.hands) &&
      note.start >= recording.from - 1e-6 &&
      note.start < recording.to,
  );
}
