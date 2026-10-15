/**
 * A practice run of one score: drives the transport for the chosen mode, matches played notes,
 * keeps live feedback and produces the summary (PLAN.md §6).
 *
 * - Tempo mode: the music plays at a steady tempo after a one-measure count-in; notes are
 *   graded on timing and missed once their window passes.
 * - Wait mode: the music stops at each note or chord until the right keys are pressed.
 * - Autoplay: the music plays by itself at a steady tempo, to watch and listen; nothing is
 *   graded and there are no results.
 * - The microphone hears one note at a time, so with it any note of a chord counts for the
 *   whole chord (in both modes).
 * - Loop: only a range of measures is practiced, over and over; each time through ends with
 *   a quick score instead of the results.
 *
 * The UI calls `tick()` every animation frame and forwards every `NoteEvent` to `handleNote`.
 */
import { InputSource, type NoteEvent, NoteEventType } from '../input/types';
import type { Pitch } from '../theory/pitch';
import { TempoMatcher, TempoResultKind } from './matching/tempoMatcher';
import { resolvePlayed } from './micAliases';
import { WaitMatcher, WaitResultKind } from './matching/waitMatcher';
import { beatsPerMeasure, msToBeats, scoreEnd, Hand, type Score, type ScoreNote } from './score';
import {
  accuracyOf,
  summarize,
  weightOf,
  type NoteOutcome,
  type Summary,
  OutcomeKind,
} from './scoring';
import { chordToleranceFor, timingOf, windowsFor, type Grade, type Timing } from './timing';
import type { Transport } from './transport';

export const FeedbackKind = {
  Hit: 'hit',
  Correct: 'correct',
  Wrong: 'wrong',
  Extra: 'extra',
  Missed: 'missed',
} as const;
export type FeedbackKind = (typeof FeedbackKind)[keyof typeof FeedbackKind];

export const HandFilter = {
  Both: 'both',
  Left: Hand.Left,
  Right: Hand.Right,
} as const;
export type HandFilter = (typeof HandFilter)[keyof typeof HandFilter];

/** Modes that grade the learner's playing (the ones lessons use). */
export const GradedMode = {
  Wait: 'wait',
  Tempo: 'tempo',
} as const;
export type GradedMode = (typeof GradedMode)[keyof typeof GradedMode];

export const PracticeMode = {
  ...GradedMode,
  /** The app plays the music by itself. */
  Autoplay: 'autoplay',
} as const;
export type PracticeMode = (typeof PracticeMode)[keyof typeof PracticeMode];

export const SessionStatus = {
  Ready: 'ready',
  Playing: 'playing',
  Waiting: 'waiting',
  Paused: 'paused',
  Finished: 'finished',
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const KeyMark = {
  Correct: 'correct',
  Wrong: 'wrong',
} as const;
export type KeyMark = (typeof KeyMark)[keyof typeof KeyMark];

export type Feedback =
  | { kind: typeof FeedbackKind.Hit; grade: Grade; timing: Timing }
  | { kind: typeof FeedbackKind.Correct }
  /** `expected`: the notes to play instead (spelled as written), for a hint. */
  | { kind: typeof FeedbackKind.Wrong; expected: Pitch[] }
  /** A key played when no note was due (rhythm exercises, where any key counts). */
  | { kind: typeof FeedbackKind.Extra }
  | { kind: typeof FeedbackKind.Missed };

export interface SessionState {
  status: SessionStatus;
  /** 1-based count while counting in, otherwise null. */
  countIn: number | null;
  /** Notes in a row without a mistake. */
  streak: number;
  /** Latest feedback; `id` changes on every new one so the UI can replay its animation. */
  feedback: { id: number; value: Feedback } | null;
  /** Verdict for each key currently held down. */
  marks: ReadonlyMap<number, KeyMark>;
  summary: Summary | null;
  /** While looping: how many times through so far, and the accuracy of the latest one. */
  lastPass: { count: number; accuracy: number } | null;
}

/** Measures to repeat, by index (0 = first measure), both included. */
export interface LoopRange {
  first: number;
  last: number;
}

export interface SessionOptions {
  mode: PracticeMode;
  hands: HandFilter;
  /** Seconds of music before the first note where playback starts (so it's on screen). */
  leadInSeconds: number;
  loop?: LoopRange | null;
  /** Input assumed for timing windows until the first note arrives. */
  defaultSource?: InputSource;
  /** Rhythm exercises: any key counts as the next note; only timing matters. */
  anyKey?: boolean;
}

const INITIAL_STATE: SessionState = {
  status: SessionStatus.Ready,
  countIn: null,
  streak: 0,
  feedback: null,
  marks: new Map(),
  summary: null,
  lastPass: null,
};

export class PracticeSession {
  readonly score: Score;
  readonly transport: Transport;
  readonly mode: PracticeMode;
  /** The notes of the selected hands. */
  readonly hands: ScoreNote[];
  /** The other hand's notes (none when practicing both). */
  readonly otherHand: ScoreNote[];

  private readonly leadInSeconds: number;
  private readonly anyKey: boolean;
  /** The loop in beats, or null to play the whole score. */
  private loop: { start: number; end: number } | null = null;
  /** The notes being graded: the selected hands, within the loop. */
  private practicedNotes: ScoreNote[] = [];
  private practicedSet: ReadonlySet<ScoreNote> = new Set();
  private source: InputSource;
  private tempoMatcher!: TempoMatcher;
  private waitMatcher!: WaitMatcher;
  private outcomes = new Map<ScoreNote, NoteOutcome>();
  private wrongBeats: number[] = [];
  private feedbackId = 0;
  /** Held microphone pitch → the expected pitch it was read as. */
  private readonly aliases = new Map<number, number>();
  private state: SessionState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();

  constructor(score: Score, transport: Transport, options: SessionOptions) {
    this.score = score;
    this.transport = transport;
    this.mode = options.mode;
    this.source = options.defaultSource ?? InputSource.Midi;
    this.leadInSeconds = options.leadInSeconds;
    this.anyKey = options.anyKey ?? false;
    this.hands = score.notes.filter(
      (n) => options.hands === HandFilter.Both || n.hand === options.hands,
    );
    this.otherHand = score.notes.filter((n) => !this.hands.includes(n));
    this.setLoop(options.loop ?? null);
  }

  /** The notes being graded: the selected hands, within the loop if there is one. */
  get practiced(): readonly ScoreNote[] {
    return this.practicedNotes;
  }

  /** Where the practiced music starts: beat 0, or the loop's first beat. */
  get musicStart(): number {
    return this.loop?.start ?? 0;
  }

  /** Where playback ends, or jumps back to the start of the loop. */
  get musicEnd(): number {
    return this.loop?.end ?? scoreEnd(this.score);
  }

  get looping(): boolean {
    return this.loop !== null;
  }

  /** First count-in beat (tempo mode: one measure before the music), or null. */
  get countInFrom(): number | null {
    return this.mode === PracticeMode.Tempo
      ? this.musicStart - beatsPerMeasure(this.score.timeSignature)
      : null;
  }

  /** Where playback starts and restarts: the lead-in or the count-in, whichever is longer. */
  get startBeat(): number {
    const leadIn = (this.leadInSeconds * this.transport.tempo) / 60;
    const countIn = this.musicStart - (this.countInFrom ?? this.musicStart);
    return this.musicStart - Math.max(leadIn, countIn);
  }

  /**
   * In wait mode the music stops at the next notes until they're played, so nothing at or
   * after this beat may sound yet (e.g. the other hand). Infinity when the music won't stop.
   */
  get holdBeat(): number {
    return this.mode === PracticeMode.Wait
      ? (this.waitMatcher.current?.start ?? Infinity)
      : Infinity;
  }

  // Controls

  play(): void {
    if (this.state.status === SessionStatus.Finished) this.reset();
    if (this.state.status === SessionStatus.Playing || this.state.status === SessionStatus.Waiting)
      return;
    this.transport.play();
    this.setState({ status: SessionStatus.Playing });
  }

  pause(): void {
    if (this.state.status !== SessionStatus.Playing && this.state.status !== SessionStatus.Waiting)
      return;
    this.transport.pause();
    this.setState({ status: SessionStatus.Paused, countIn: null });
  }

  restart(): void {
    this.reset();
  }

  /** Practices only these measures, over and over (null: the whole score). Starts over. */
  setLoop(range: LoopRange | null): void {
    const { measures } = this.score;
    const first = range ? measures[Math.max(0, range.first)] : undefined;
    const last = range ? measures[Math.min(measures.length - 1, range.last)] : undefined;
    this.loop =
      first && last && first.start <= last.start
        ? { start: first.start, end: last.start + last.length }
        : null;
    const inLoop = (note: ScoreNote) =>
      !this.loop || (note.start >= this.loop.start && note.start < this.loop.end);
    this.practicedNotes = this.hands.filter(inLoop);
    this.practicedSet = new Set(this.practicedNotes);
    this.reset();
  }

  /** Plays slower or faster from where it is; before starting, moves to the new lead-in. */
  setTempo(tempo: number): void {
    this.transport.setTempo(tempo);
    if (this.state.status === SessionStatus.Ready) this.transport.seek(this.startBeat);
  }

  // Input and time

  handleNote(event: NoteEvent): void {
    if (event.type === NoteEventType.Off) {
      const pitch = this.aliases.get(event.pitch) ?? event.pitch;
      this.aliases.delete(event.pitch);
      this.waitMatcher.release(pitch);
      if (this.state.marks.has(pitch)) {
        const marks = new Map(this.state.marks);
        marks.delete(pitch);
        this.setState({ marks });
      }
      return;
    }
    if (this.state.status !== SessionStatus.Playing && this.state.status !== SessionStatus.Waiting)
      return;
    if (this.mode === PracticeMode.Autoplay) return; // nothing to grade

    this.source = event.source;
    const beat = this.transport.positionAt(event.time);
    const pitch = this.resolvePitch(event, beat);
    if (pitch !== event.pitch) this.aliases.set(event.pitch, pitch);
    const press = { ...event, pitch };
    if (this.mode === PracticeMode.Tempo) this.handleTempoPress(press, beat);
    else this.handleWaitPress(press, beat);
  }

  /** Call every animation frame. */
  tick(): void {
    const { status } = this.state;
    if (status !== SessionStatus.Playing && status !== SessionStatus.Waiting) return;
    const position = this.transport.position();

    if (this.mode === PracticeMode.Tempo) {
      const missed = this.tempoMatcher.advance(position, this.transport.tempo, this.windows());
      for (const note of missed) this.outcomes.set(note, { kind: OutcomeKind.Missed });
      if (missed.length > 0)
        this.setState({ streak: 0, feedback: this.feedback({ kind: FeedbackKind.Missed }) });

      const from = this.countInFrom;
      const countIn =
        from !== null && position >= from && position < this.musicStart
          ? Math.floor(position - from) + 1
          : null;
      if (countIn !== this.state.countIn) this.setState({ countIn });
    } else if (this.mode === PracticeMode.Wait) {
      const group = this.waitMatcher.current;
      if (group && status === SessionStatus.Playing && position >= group.start) {
        this.transport.pause();
        this.transport.seek(group.start);
        this.setState({ status: SessionStatus.Waiting });
      }
    }

    if (position < this.musicEnd) return;
    if (this.mode === PracticeMode.Autoplay) {
      if (this.loop) this.transport.seek(this.loop.start + (position - this.loop.end));
      else this.stop();
      return;
    }
    const matched =
      this.mode === PracticeMode.Tempo ? this.tempoMatcher.done : this.waitMatcher.done;
    // When looping in tempo mode, time doesn't wait for notes still in their window.
    if (this.loop && (matched || this.mode === PracticeMode.Tempo))
      this.nextPass(this.loop, position);
    else if (matched) this.finish();
  }

  // Queries

  outcomeOf(note: ScoreNote): NoteOutcome | undefined {
    return this.outcomes.get(note);
  }

  isGraded(note: ScoreNote): boolean {
    return this.practicedSet.has(note);
  }

  /** The key a held input pitch counts as (a microphone note may be read as an expected one). */
  displayPitch(pitch: number): number {
    return this.aliases.get(pitch) ?? pitch;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): SessionState => this.state;

  // Internals

  private handleTempoPress(event: NoteEvent, beat: number): void {
    const windows = this.windows();
    const tempo = this.transport.tempo;
    // Ignore playing around before the music starts (e.g. during the count-in).
    if (beat < this.musicStart - msToBeats(windows.ok, tempo)) return;

    const result = this.tempoMatcher.play(event.pitch, beat, tempo, windows);
    if (result.kind === TempoResultKind.Hit) {
      const outcome: NoteOutcome = {
        kind: OutcomeKind.Hit,
        grade: result.grade,
        errorMs: result.errorMs,
      };
      this.outcomes.set(result.note, outcome);
      if (event.source === InputSource.Mic) {
        for (const note of this.tempoMatcher.takeChord(result.note)) {
          this.outcomes.set(note, outcome);
        }
      }
      this.mark(event.pitch, KeyMark.Correct, {
        streak: this.state.streak + 1,
        feedback: this.feedback({
          kind: FeedbackKind.Hit,
          grade: result.grade,
          timing: timingOf(result.errorMs, windows),
        }),
      });
    } else if (!this.isUngradedNote(event.pitch, beat)) {
      this.wrong(event.pitch, beat);
    }
  }

  private handleWaitPress(event: NoteEvent, beat: number): void {
    const group = this.waitMatcher.current;
    const result = this.waitMatcher.press(
      event.pitch,
      event.time,
      chordToleranceFor(event.source),
      event.source === InputSource.Mic,
    );
    if (result.kind === WaitResultKind.Wrong) {
      if (!this.isUngradedNote(event.pitch, beat)) this.wrong(event.pitch, beat);
      return;
    }
    if (result.groupComplete && group) {
      for (const note of group.notes) this.outcomes.set(note, { kind: OutcomeKind.Correct });
    }
    this.mark(event.pitch, KeyMark.Correct, {
      streak: this.state.streak + 1,
      feedback: this.feedback({ kind: FeedbackKind.Correct }),
    });
    if (result.groupComplete && this.state.status === SessionStatus.Waiting) {
      this.transport.play();
      this.setState({ status: SessionStatus.Playing });
    }
  }

  private wrong(pitch: number, beat: number): void {
    this.wrongBeats.push(beat);
    this.mark(pitch, KeyMark.Wrong, {
      streak: 0,
      feedback: this.feedback(
        this.anyKey
          ? { kind: FeedbackKind.Extra }
          : { kind: FeedbackKind.Wrong, expected: this.expectedAt(beat) },
      ),
    });
  }

  /** The notes the learner should be playing around `beat`. */
  private expectedAt(beat: number): Pitch[] {
    const notes =
      this.mode === PracticeMode.Tempo
        ? this.tempoMatcher.upcoming(beat, this.transport.tempo, this.windows())
        : this.waitMatcher.missing;
    return [...notes].sort((a, b) => a.pitch.midi - b.pitch.midi).map((note) => note.pitch);
  }

  /**
   * The key a played note counts as: with `anyKey`, the next note due (its pitch); for the
   * microphone, an expected note it's easily confused with; otherwise itself.
   */
  private resolvePitch(event: NoteEvent, beat: number): number {
    if (!this.anyKey && event.source !== InputSource.Mic) return event.pitch;
    const expected =
      this.mode === PracticeMode.Tempo
        ? this.tempoMatcher
            .candidates(beat, this.transport.tempo, this.windows())
            .map((note) => note.pitch.midi)
        : (this.waitMatcher.current?.notes.map((note) => note.pitch.midi) ?? []);
    if (this.anyKey) return expected[0] ?? event.pitch;
    return resolvePlayed(event.pitch, event.source, expected);
  }

  /**
   * Keys of notes that aren't graded aren't mistakes: the other hand's when grading one hand,
   * or those just outside the loop.
   */
  private isUngradedNote(pitch: number, beat: number): boolean {
    const slack = msToBeats(this.windows().ok, this.transport.tempo);
    return this.score.notes.some(
      (note) =>
        !this.practicedSet.has(note) &&
        note.pitch.midi === pitch &&
        beat >= note.start - slack &&
        beat <= note.start + note.duration + slack,
    );
  }

  private mark(pitch: number, mark: KeyMark, patch: Partial<SessionState>): void {
    const marks = new Map(this.state.marks);
    marks.set(pitch, mark);
    this.setState({ ...patch, marks });
  }

  private feedback(value: Feedback): SessionState['feedback'] {
    return { id: ++this.feedbackId, value };
  }

  private windows() {
    return windowsFor(this.source);
  }

  private finish(): void {
    this.transport.pause();
    this.setState({
      status: SessionStatus.Finished,
      countIn: null,
      summary: summarize(
        this.hands,
        this.outcomes,
        this.wrongBeats,
        this.score.measures,
        this.mode === PracticeMode.Tempo ? this.windows() : undefined,
      ),
    });
  }

  /** The end of autoplay: finished, without results. */
  private stop(): void {
    this.transport.pause();
    this.setState({ status: SessionStatus.Finished, countIn: null });
  }

  /** The end of the loop: scores this time through and jumps back, keeping the beat. */
  private nextPass(loop: { start: number; end: number }, position: number): void {
    const notes = this.practicedNotes;
    const weights = notes.reduce((sum, note) => sum + weightOf(this.outcomes.get(note)), 0);
    const accuracy = accuracyOf(weights, this.wrongBeats.length, notes.length);
    this.resetMatching();
    this.transport.seek(loop.start + (position - loop.end));
    this.setState({ lastPass: { count: (this.state.lastPass?.count ?? 0) + 1, accuracy } });
  }

  private resetMatching(): void {
    this.tempoMatcher = new TempoMatcher(this.practicedNotes);
    this.waitMatcher = new WaitMatcher(this.practicedNotes);
    this.outcomes = new Map();
    this.wrongBeats = [];
  }

  private reset(): void {
    this.resetMatching();
    this.aliases.clear();
    this.transport.pause();
    this.transport.seek(this.startBeat);
    this.state = { ...INITIAL_STATE, marks: new Map() };
    this.notify();
  }

  private setState(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
