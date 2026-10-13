/**
 * A practice run of one score: drives the transport for the chosen mode, matches played notes,
 * keeps live feedback and produces the summary (PLAN.md §6).
 *
 * - Tempo mode: the music plays at a steady tempo after a one-measure count-in; notes are
 *   graded on timing and missed once their window passes.
 * - Wait mode: the music stops at each note or chord until the right keys are pressed.
 *
 * The UI calls `tick()` every animation frame and forwards every `NoteEvent` to `handleNote`.
 */
import type { InputSourceKind, NoteEvent } from '../input/types';
import { TempoMatcher } from './matching/tempoMatcher';
import { WaitMatcher } from './matching/waitMatcher';
import {
  beatsPerMeasure,
  msToBeats,
  scoreEnd,
  type Hand,
  type Score,
  type ScoreNote,
} from './score';
import { summarize, type NoteOutcome, type Summary } from './scoring';
import { chordToleranceFor, timingOf, windowsFor, type Grade, type Timing } from './timing';
import type { Transport } from './transport';

export type PracticeMode = 'wait' | 'tempo';
export type HandFilter = 'both' | Hand;
export type SessionStatus = 'ready' | 'playing' | 'waiting' | 'paused' | 'finished';
export type KeyMark = 'correct' | 'wrong';

export type Feedback =
  | { kind: 'hit'; grade: Grade; timing: Timing }
  | { kind: 'correct' }
  | { kind: 'wrong' }
  | { kind: 'missed' };

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
}

export interface SessionOptions {
  mode: PracticeMode;
  hands: HandFilter;
  /** Beats before the first note where playback starts (so the first notes are on screen). */
  leadIn: number;
  /** Input assumed for timing windows until the first note arrives. */
  defaultSource?: InputSourceKind;
}

/**
 * Pitch differences (detected − expected) the microphone tends to confuse: octaves, and the
 * octave plus a fifth (the strong third harmonic of piano tones). Near an expected note, a
 * microphone note at one of these distances counts as that note (PLAN.md §12).
 */
const MIC_ALIASES = [12, -12, 24, -24, 19];

const INITIAL_STATE: SessionState = {
  status: 'ready',
  countIn: null,
  streak: 0,
  feedback: null,
  marks: new Map(),
  summary: null,
};

export class PracticeSession {
  readonly score: Score;
  readonly transport: Transport;
  readonly mode: PracticeMode;
  /** The notes being graded (the selected hands). */
  readonly graded: ScoreNote[];
  /** First count-in beat (tempo mode), or null. */
  readonly countInFrom: number | null;
  /** Where playback starts and restarts. */
  readonly startBeat: number;

  private readonly gradedSet: ReadonlySet<ScoreNote>;
  private readonly otherHand: ScoreNote[];
  private readonly end: number;
  private source: InputSourceKind;
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
    this.source = options.defaultSource ?? 'midi';
    this.graded = score.notes.filter((n) => options.hands === 'both' || n.hand === options.hands);
    this.gradedSet = new Set(this.graded);
    this.otherHand = score.notes.filter((n) => !this.gradedSet.has(n));
    this.end = scoreEnd(score);
    this.countInFrom = this.mode === 'tempo' ? -beatsPerMeasure(score.timeSignature) : null;
    this.startBeat = -Math.max(options.leadIn, -(this.countInFrom ?? 0));
    this.reset();
  }

  // Controls

  play(): void {
    if (this.state.status === 'finished') this.reset();
    if (this.state.status === 'playing' || this.state.status === 'waiting') return;
    this.transport.play();
    this.setState({ status: 'playing' });
  }

  pause(): void {
    if (this.state.status !== 'playing' && this.state.status !== 'waiting') return;
    this.transport.pause();
    this.setState({ status: 'paused', countIn: null });
  }

  restart(): void {
    this.reset();
  }

  // Input and time

  handleNote(event: NoteEvent): void {
    if (event.type === 'off') {
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
    if (this.state.status !== 'playing' && this.state.status !== 'waiting') return;

    this.source = event.source;
    const beat = this.transport.positionAt(event.time);
    const pitch = this.resolvePitch(event, beat);
    if (pitch !== event.pitch) this.aliases.set(event.pitch, pitch);
    const press = { ...event, pitch };
    if (this.mode === 'tempo') this.handleTempoPress(press, beat);
    else this.handleWaitPress(press, beat);
  }

  /** Call every animation frame. */
  tick(): void {
    const { status } = this.state;
    if (status !== 'playing' && status !== 'waiting') return;
    const position = this.transport.position();

    if (this.mode === 'tempo') {
      const missed = this.tempoMatcher.advance(position, this.transport.tempo, this.windows());
      for (const note of missed) this.outcomes.set(note, { kind: 'missed' });
      if (missed.length > 0)
        this.setState({ streak: 0, feedback: this.feedback({ kind: 'missed' }) });

      const countIn =
        this.countInFrom !== null && position >= this.countInFrom && position < 0
          ? Math.floor(position - this.countInFrom) + 1
          : null;
      if (countIn !== this.state.countIn) this.setState({ countIn });
    } else {
      const group = this.waitMatcher.current;
      if (group && status === 'playing' && position >= group.start) {
        this.transport.pause();
        this.transport.seek(group.start);
        this.setState({ status: 'waiting' });
      }
    }

    const matched = this.mode === 'tempo' ? this.tempoMatcher.done : this.waitMatcher.done;
    if (matched && position >= this.end) this.finish();
  }

  // Queries

  outcomeOf(note: ScoreNote): NoteOutcome | undefined {
    return this.outcomes.get(note);
  }

  isGraded(note: ScoreNote): boolean {
    return this.gradedSet.has(note);
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
    if (beat < -msToBeats(windows.ok, tempo)) return;

    const result = this.tempoMatcher.play(event.pitch, beat, tempo, windows);
    if (result.kind === 'hit') {
      this.outcomes.set(result.note, {
        kind: 'hit',
        grade: result.grade,
        errorMs: result.errorMs,
      });
      this.mark(event.pitch, 'correct', {
        streak: this.state.streak + 1,
        feedback: this.feedback({
          kind: 'hit',
          grade: result.grade,
          timing: timingOf(result.errorMs, windows),
        }),
      });
    } else if (!this.isOtherHandNote(event.pitch, beat)) {
      this.wrong(event.pitch, beat);
    }
  }

  private handleWaitPress(event: NoteEvent, beat: number): void {
    const group = this.waitMatcher.current;
    const result = this.waitMatcher.press(event.pitch, event.time, chordToleranceFor(event.source));
    if (result.kind === 'wrong') {
      if (!this.isOtherHandNote(event.pitch, beat)) this.wrong(event.pitch, beat);
      return;
    }
    if (result.groupComplete && group) {
      for (const note of group.notes) this.outcomes.set(note, { kind: 'correct' });
    }
    this.mark(event.pitch, 'correct', {
      streak: this.state.streak + 1,
      feedback: this.feedback({ kind: 'correct' }),
    });
    if (result.groupComplete && this.state.status === 'waiting') {
      this.transport.play();
      this.setState({ status: 'playing' });
    }
  }

  private wrong(pitch: number, beat: number): void {
    this.wrongBeats.push(beat);
    this.mark(pitch, 'wrong', { streak: 0, feedback: this.feedback({ kind: 'wrong' }) });
  }

  /** A microphone note close to an expected note in a confusable way counts as that note. */
  private resolvePitch(event: NoteEvent, beat: number): number {
    if (event.source !== 'mic') return event.pitch;
    const expected =
      this.mode === 'tempo'
        ? this.tempoMatcher
            .candidates(beat, this.transport.tempo, this.windows())
            .map((note) => note.pitch.midi)
        : (this.waitMatcher.current?.notes.map((note) => note.pitch.midi) ?? []);
    if (expected.includes(event.pitch)) return event.pitch;
    return expected.find((pitch) => MIC_ALIASES.includes(event.pitch - pitch)) ?? event.pitch;
  }

  /** When grading one hand, keys that belong to the other hand's notes aren't mistakes. */
  private isOtherHandNote(pitch: number, beat: number): boolean {
    const slack = msToBeats(this.windows().ok, this.transport.tempo);
    return this.otherHand.some(
      (note) =>
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
      status: 'finished',
      countIn: null,
      summary: summarize(this.graded, this.outcomes, this.wrongBeats, this.score.measures),
    });
  }

  private reset(): void {
    this.tempoMatcher = new TempoMatcher(this.graded);
    this.waitMatcher = new WaitMatcher(this.graded);
    this.outcomes = new Map();
    this.wrongBeats = [];
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
