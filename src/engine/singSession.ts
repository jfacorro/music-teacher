/**
 * A run of a melody sung to the microphone (PLAN.md milestone 6.3): drives the transport for the
 * mode, follows the pitch readings and produces the summary. The voice's `PracticeSession`.
 *
 * - Wait for me: the music stops at each note until it's held in tune (`WaitSinger`); the app can
 *   play each note first (the guide), and listens once it has stopped ringing.
 * - Sing along: after a measure counted in, the music keeps going (`SungTake`), the guide melody
 *   playing along if chosen.
 * - Listen first: the app plays the melody, then counts in and it's sung without the guide.
 *
 * The UI calls `tick()` every animation frame and passes every microphone reading to `reading`.
 */
import {
  beatsPerMeasure,
  countedBeat,
  msToBeats,
  scoreEnd,
  type Score,
  type ScoreNote,
} from './score';
import {
  centsOff,
  SING_WINDOW_MS,
  singSummary,
  SingMode,
  type SingOptions,
  type SingSummary,
  SungTake,
  type SungNote,
  WaitSinger,
} from './singing';
import type { Transport } from './transport';

export const SingStatus = {
  Ready: 'ready',
  /** Listen first: the app is playing the melody. */
  Listening: 'listening',
  Playing: 'playing',
  /** Wait for me: at a note, until it's sung in tune. */
  Waiting: 'waiting',
  Paused: 'paused',
  Finished: 'finished',
} as const;
export type SingStatus = (typeof SingStatus)[keyof typeof SingStatus];

/** What's being sung now, against the note to sing. */
export interface LiveVoice {
  /** Exact pitch in semitones. */
  pitch: number;
  /** The note to sing now, if any, and how far from it in cents. */
  target: number | null;
  cents: number | null;
  inTune: boolean;
}

/** A reading on the line of the voice: where, and whether in tune with the note to sing. */
export interface TrailPoint {
  beat: number;
  /**
   * The pitch drawn (semitones): in the octave nearest the note to sing when any octave counts,
   * so the line runs through the notes; null when nothing clear was heard.
   */
  pitch: number | null;
  /** In tune with the note sounding then; null when there was none. */
  inTune: boolean | null;
}

export interface SingState {
  status: SingStatus;
  /** 1-based count while counting in, otherwise null. */
  countIn: number | null;
  /** Wait for me: how far into holding the note in tune, 0–1. */
  held: number;
  /** The latest reading, while something is heard. */
  voice: LiveVoice | null;
  summary: SingSummary | null;
}

export interface SingSessionOptions extends SingOptions {
  mode: SingMode;
  /** Seconds of music shown before the first note where playback starts. */
  leadInSeconds: number;
}

/** Singing within this many semitones of the note to sing, the voice is drawn in its octave. */
const NEAR_SEMITONES = 3;

/** As in `PracticeSession`: a count-in starts a moment before its first click. */
const PRE_ROLL_SECONDS = 0.25;

const INITIAL_STATE: SingState = {
  status: SingStatus.Ready,
  countIn: null,
  held: 0,
  voice: null,
  summary: null,
};

export class SingSession {
  readonly score: Score;
  readonly transport: Transport;
  readonly mode: SingMode;
  private readonly options: SingSessionOptions;
  private take!: SungTake;
  private waiter!: WaitSinger;
  /** Graded notes so far, for their colors. */
  private graded = new Map<ScoreNote, SungNote>();
  /** Listen first: the app has played the melody, and now it's sung. */
  private singing = false;
  private trailPoints: TrailPoint[] = [];
  private state: SingState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();

  constructor(score: Score, transport: Transport, options: SingSessionOptions) {
    this.score = score;
    this.transport = transport;
    this.mode = options.mode;
    this.options = options;
    this.reset();
  }

  get notes(): readonly ScoreNote[] {
    return this.score.notes;
  }

  get musicEnd(): number {
    return scoreEnd(this.score);
  }

  /** First count-in beat (a measure before the music, when singing in tempo), or null. */
  get countInFrom(): number | null {
    const counts =
      this.mode === SingMode.Along || (this.mode === SingMode.ListenFirst && this.singing);
    return counts ? -beatsPerMeasure(this.score.timeSignature) : null;
  }

  /** Where playback starts: the lead-in, or the count-in, whichever is longer. */
  get startBeat(): number {
    const beats = (seconds: number) => (seconds * this.transport.tempo) / 60;
    const from = this.countInFrom;
    const countIn = from === null ? 0 : -from + beats(PRE_ROLL_SECONDS);
    return -Math.max(beats(this.options.leadInSeconds), countIn);
  }

  /** Wait for me: where the music stops next (Infinity otherwise). */
  get holdBeat(): number {
    return this.mode === SingMode.Wait ? (this.waiter.current?.start ?? Infinity) : Infinity;
  }

  /** Wait for me: the note waited at, while waiting. */
  get waitingFor(): ScoreNote | undefined {
    return this.state.status === SingStatus.Waiting ? this.waiter.current : undefined;
  }

  /** The app plays the melody now: listening first, or singing along with the guide. */
  get appPlays(): boolean {
    return this.state.status === SingStatus.Listening;
  }

  /** What was sung in tempo so far, for the line of the voice (none waiting for each note). */
  get trail(): readonly TrailPoint[] {
    return this.trailPoints;
  }

  /** How a note went, once graded. */
  resultOf(note: ScoreNote): SungNote | undefined {
    return this.graded.get(note);
  }

  // Controls

  play(): void {
    if (this.state.status === SingStatus.Finished) this.reset();
    const { status } = this.state;
    if (status === SingStatus.Playing || status === SingStatus.Waiting) return;
    if (status === SingStatus.Listening) return;
    this.transport.play();
    const listening = this.mode === SingMode.ListenFirst && !this.singing;
    this.setState({ status: listening ? SingStatus.Listening : SingStatus.Playing });
  }

  pause(): void {
    const { status } = this.state;
    const going = [SingStatus.Playing, SingStatus.Waiting, SingStatus.Listening] as SingStatus[];
    if (!going.includes(status)) return;
    this.transport.pause();
    this.setState({ status: SingStatus.Paused, countIn: null });
  }

  restart(): void {
    this.reset();
  }

  /** Wait for me: the current note is due from `time` (ms), e.g. once the app has played it. */
  listenFrom(time: number): void {
    this.waiter.listen(time);
  }

  /** Wait for me: moves on without finding the note waited at. */
  skip(): void {
    if (this.state.status !== SingStatus.Waiting) return;
    this.waiter.skip();
    this.afterWaiting();
  }

  // Input and time

  /** A microphone reading: the exact pitch (or null), sung at `time` (ms). */
  reading(pitch: number | null, time: number): void {
    const { status } = this.state;
    if (status !== SingStatus.Playing && status !== SingStatus.Waiting) {
      if (this.state.voice) this.setState({ voice: null });
      return;
    }
    const beat = this.transport.positionAt(time);
    if (status === SingStatus.Waiting) {
      const note = this.waiter.current;
      const { held, found } = this.waiter.update(pitch, time, beat);
      // While the app plays the note, the microphone hears the app.
      const heard = this.waiter.listening(time) ? pitch : null;
      this.setState({ held, voice: this.voiceAt(heard, note) });
      if (found) this.afterWaiting();
      return;
    }
    if (this.mode === SingMode.Wait) {
      this.setState({ voice: this.voiceAt(pitch, undefined) });
      return;
    }
    this.take.add({ time, beat, pitch });
    const note = this.take.noteAt(beat);
    const voice = this.voiceAt(pitch, note);
    this.trailPoints.push({
      beat,
      pitch: pitch === null ? null : this.drawnPitch(pitch, note?.pitch.midi ?? null),
      inTune: voice && note ? voice.inTune : null,
    });
    this.setState({ voice });
  }

  /** Call every animation frame. */
  tick(): void {
    const { status } = this.state;
    if (status !== SingStatus.Playing && status !== SingStatus.Listening) return;
    const position = this.transport.position();

    if (this.mode === SingMode.Wait) {
      const note = this.waiter.current;
      if (note && position >= note.start) {
        this.transport.pause();
        this.transport.seek(note.start);
        this.setState({ status: SingStatus.Waiting, held: 0 });
        return;
      }
    } else if (status === SingStatus.Playing) {
      this.gradePassedNotes(position);
    }

    const from = this.countInFrom;
    const countIn =
      from !== null && position >= from && position < 0
        ? Math.floor((position - from) / countedBeat(this.score.timeSignature) + 1e-9) + 1
        : null;
    if (countIn !== this.state.countIn) this.setState({ countIn });

    if (status === SingStatus.Listening) {
      if (position >= this.musicEnd) {
        // Now it's sung: a measure counted in, then the melody without the guide.
        this.singing = true;
        this.transport.seek(this.startBeat);
        this.setState({ status: SingStatus.Playing });
      }
      return;
    }
    const slack = this.mode === SingMode.Wait ? 0 : msToBeats(SING_WINDOW_MS, this.transport.tempo);
    if (position < this.musicEnd + slack) return;
    if (this.mode === SingMode.Wait && !this.waiter.finished) return;
    this.finish();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): SingState => this.state;

  // Internals

  private voiceAt(pitch: number | null, note: ScoreNote | undefined): LiveVoice | null {
    if (pitch === null) return null;
    if (!note) return { pitch, target: null, cents: null, inTune: false };
    const cents = centsOff(note.pitch.midi, pitch, this.options.octave);
    return {
      pitch,
      target: note.pitch.midi,
      cents,
      inTune: Math.abs(cents) <= this.options.cents,
    };
  }

  /**
   * Where the voice is drawn when any octave counts: in the octave of the note to sing when it's
   * near it, otherwise in the octave nearest the middle of the melody (so the line doesn't jump
   * from one octave to another as the notes change).
   */
  drawnPitch(pitch: number, target: number | null): number {
    if (this.options.octave) return pitch;
    const fold = (around: number) => pitch - 12 * Math.round((pitch - around) / 12);
    if (target !== null && Math.abs(fold(target) - target) <= NEAR_SEMITONES) return fold(target);
    return fold(this.middle);
  }

  /** The middle of the melody, in semitones. */
  private get middle(): number {
    const pitches = this.score.notes.map((note) => note.pitch.midi);
    return (Math.min(...pitches) + Math.max(...pitches)) / 2;
  }

  /** Singing in tempo: notes are graded once they're over. */
  private gradePassedNotes(position: number): void {
    const slack = msToBeats(SING_WINDOW_MS, this.transport.tempo);
    let changed = false;
    this.take.notes.forEach((note, i) => {
      if (this.graded.has(note) || position < note.start + note.duration + slack) return;
      this.graded.set(note, this.take.result(i));
      changed = true;
    });
    if (changed) this.setState({});
  }

  /** Wait for me: the note was found or skipped, and the music goes on. */
  private afterWaiting(): void {
    for (const result of this.waiter.results()) this.graded.set(result.note, result);
    this.transport.play();
    this.setState({ status: SingStatus.Playing, held: 0 });
  }

  private finish(): void {
    this.transport.pause();
    const results = this.mode === SingMode.Wait ? this.waiter.results() : this.take.results();
    for (const result of results) this.graded.set(result.note, result);
    this.setState({
      status: SingStatus.Finished,
      countIn: null,
      voice: null,
      summary: singSummary(results),
    });
  }

  private reset(): void {
    this.take = new SungTake(this.score.notes, this.transport.tempo, this.options);
    this.waiter = new WaitSinger(this.score.notes, this.options);
    this.graded = new Map();
    this.singing = false;
    this.trailPoints = [];
    this.transport.pause();
    this.transport.seek(this.startBeat);
    this.state = { ...INITIAL_STATE };
    this.notify();
  }

  private setState(patch: Partial<SingState>): void {
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
