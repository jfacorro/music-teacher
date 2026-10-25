/**
 * Singing a melody (PLAN.md milestone 6.3): how each written note was sung, from the microphone's
 * pitch readings. The voice's matcher, next to the piano's (`TempoMatcher`, `WaitMatcher`).
 *
 * - Singing along (and Listen first, once the app has played it): the music keeps going. Each
 *   note is graded on how much of its time was in tune, whether it started within the timing
 *   window, and how steady it stayed.
 * - Wait for me: the music waits at each note until it's held in tune for `WAIT_HOLD_MS`. A note
 *   counts in full when it's found within `MATCH_WITHIN_MS` of being due, as in Match the note.
 *
 * Any octave counts unless the written one is asked for. Melodies are one note at a time.
 */
import { centsFrom, MATCH_CENTS, MATCH_WITHIN_MS } from './matchNote';
import { beatsToMs, type ScoreNote } from './score';
import { accuracyOf, starsFor } from './scoring';
import { AVERAGE_OF, IN_TUNE_CENTS, type PitchLean, pitchLean } from './tuner';
import { HeldNote } from './vocalRange';

export const SingMode = {
  /** The music waits at each note until it's sung in tune. */
  Wait: 'wait',
  /** The music keeps going, the guide melody playing along if chosen. */
  Along: 'along',
  /** The app plays the melody first, then it's sung along with the beat. */
  ListenFirst: 'listenFirst',
} as const;
export type SingMode = (typeof SingMode)[keyof typeof SingMode];

/** In tune: within this many cents of the note (`MATCH_CENTS`), or `IN_TUNE_CENTS` when strict. */
export const SING_CENTS = MATCH_CENTS;
export const SING_CENTS_STRICT = IN_TUNE_CENTS;
/** Wait for me: a note is found once held in tune this long, ms. */
export const WAIT_HOLD_MS = 300;
/** A note started on time when it was first in tune within this long of its beat, ms. */
export const SING_WINDOW_MS = 250;
/** The start of each note, slid into, doesn't count against how much of it was in tune, ms. */
const SLIDE_IN_MS = 150;
/** Steady: the voice (averaged over vibrato) stays within this many cents of where it sat. */
export const STEADY_CENTS = 20;
/** In tune for this share of its time, a note counts in full. */
const FULL_CREDIT = 0.8;
/** A note started outside the timing window counts this much. */
const LATE_CREDIT = 0.75;
/** Wait for me: a note found after `MATCH_WITHIN_MS` counts this much. */
const SLOW_CREDIT = 0.5;
/** Singing this far from a note (cents) is aimed at it, to say how flat or sharp it was. */
const AIMED_CENTS = 100;
/** A note in tune for less of its time than this is one to work on. */
const WORK_ON_IN_TUNE = 0.6;

export interface SingOptions {
  /** How close counts as in tune, in cents. */
  cents: number;
  /** Only the written octave counts. */
  octave: boolean;
}

/** A pitch reading during a run. */
export interface SungReading {
  /** performance.now() ms, when it was sung. */
  time: number;
  /** Where the music was then, in beats. */
  beat: number;
  /** Exact pitch in semitones, or null when nothing clear was heard. */
  pitch: number | null;
}

/** How many cents `pitch` is from the note: from its nearest octave, or the written one. */
export function centsOff(target: number, pitch: number, octave: boolean): number {
  return octave ? Math.round((pitch - target) * 100) : centsFrom(target, pitch);
}

/** How one written note was sung. */
export interface SungNote {
  note: ScoreNote;
  /** Share of its time in tune, 0–1. */
  inTune: number;
  /**
   * Singing along: when it was first in tune, ms from its beat (negative = early), or null when it
   * never was; wait for me: how long it took to find, ms from being due, or null when skipped.
   */
  startMs: number | null;
  /** Singing along: started within the timing window; null waiting for each note. */
  onTime: boolean | null;
  /** Share of its sung time it stayed steady, 0–1; null when too little was sung. */
  steady: number | null;
  /** How far off on average while aimed at it, in cents (negative = flat); null when not sung. */
  offset: number | null;
  /** What it counts toward accuracy, 0–1. */
  credit: number;
}

/** The singing in tempo (along, or after listening first): grades each note once it's over. */
export class SungTake {
  readonly notes: readonly ScoreNote[];
  private readonly options: SingOptions;
  private readonly tempo: number;
  private readings: SungReading[] = [];

  constructor(notes: readonly ScoreNote[], tempo: number, options: SingOptions) {
    this.notes = [...notes].sort((a, b) => a.start - b.start);
    this.tempo = tempo;
    this.options = options;
  }

  add(reading: SungReading): void {
    this.readings.push(reading);
  }

  /** The note sounding at `beat`, if any (the one to sing). */
  noteAt(beat: number): ScoreNote | undefined {
    return this.notes.find((note) => note.start <= beat && beat < note.start + note.duration);
  }

  /** Whether `pitch` is in tune with `note`. */
  inTune(note: ScoreNote, pitch: number): boolean {
    return Math.abs(centsOff(note.pitch.midi, pitch, this.options.octave)) <= this.options.cents;
  }

  /** How the note at `index` went, from the readings so far. */
  result(index: number): SungNote {
    const note = this.notes[index]!;
    const before = this.notes[index - 1];
    const { cents, octave } = this.options;
    const ms = (beat: number) => beatsToMs(beat - note.start, this.tempo);
    const end = ms(note.start + note.duration);
    const off = (pitch: number) => centsOff(note.pitch.midi, pitch, octave);

    // How much of it was in tune, after sliding in (all of it when it's that short).
    const during = this.readings.filter((r) => ms(r.beat) >= 0 && ms(r.beat) < end);
    const slideIn = Math.min(SLIDE_IN_MS, end / 2);
    const graded = during.filter((r) => ms(r.beat) >= slideIn);
    const counted = graded.length > 0 ? graded : during;
    const tuned = counted.filter((r) => r.pitch !== null && Math.abs(off(r.pitch)) <= cents);
    const inTune = counted.length === 0 ? 0 : tuned.length / counted.length;

    // When it started: the first time in tune for two readings in a row, from a little before its
    // beat (but not while the note before, on the same pitch, was still being sung).
    const samePitch = before && before.pitch.midi === note.pitch.midi;
    const from = samePitch ? 0 : -SING_WINDOW_MS;
    const around = this.readings.filter((r) => ms(r.beat) >= from && ms(r.beat) < end);
    let startMs: number | null = null;
    for (let i = 0; i + 1 < around.length; i++) {
      const [a, b] = [around[i]!, around[i + 1]!];
      if (a.pitch !== null && b.pitch !== null && Math.abs(off(a.pitch)) <= cents) {
        if (Math.abs(off(b.pitch)) <= cents) {
          startMs = Math.round(ms(a.beat));
          break;
        }
      }
    }
    const onTime = startMs !== null && Math.abs(startMs) <= SING_WINDOW_MS;
    const credit =
      Math.min(1, inTune / FULL_CREDIT) * (onTime || startMs === null ? 1 : LATE_CREDIT);
    return {
      note,
      inTune,
      startMs,
      onTime,
      ...pitchStats(counted, off),
      credit: startMs === null ? 0 : credit,
    };
  }

  /** Every note, graded. */
  results(): SungNote[] {
    return this.notes.map((_, i) => this.result(i));
  }

  /** The readings so far, in order (for the line of what was sung). */
  get sung(): readonly SungReading[] {
    return this.readings;
  }
}

/** How steady the singing was and how far off on average, over the readings aimed at a note. */
function pitchStats(
  readings: readonly SungReading[],
  off: (pitch: number) => number,
): { steady: number | null; offset: number | null } {
  const cents = readings.flatMap((r) => (r.pitch === null ? [] : [off(r.pitch)]));
  const aimed = cents.filter((c) => Math.abs(c) <= AIMED_CENTS);
  const offset = aimed.length === 0 ? null : Math.round(average(aimed));
  if (aimed.length < AVERAGE_OF) return { steady: null, offset };
  // Averaged over a few readings, vibrato doesn't count as unsteady.
  const smooth = aimed.slice(AVERAGE_OF - 1).map((_, i) => average(aimed.slice(i, i + AVERAGE_OF)));
  const middle = median(smooth);
  const steady = smooth.filter((c) => Math.abs(c - middle) <= STEADY_CENTS).length / smooth.length;
  return { steady, offset };
}

/** Wait for me: the music waits at each note until it's held in tune. */
export class WaitSinger {
  readonly notes: readonly ScoreNote[];
  private readonly options: SingOptions;
  private index = 0;
  private hold = new HeldNote(WAIT_HOLD_MS);
  private dueAt = 0;
  private readings: SungReading[] = [];
  private readonly done: SungNote[] = [];

  constructor(notes: readonly ScoreNote[], options: SingOptions) {
    this.notes = [...notes].sort((a, b) => a.start - b.start);
    this.options = options;
  }

  get current(): ScoreNote | undefined {
    return this.notes[this.index];
  }

  get finished(): boolean {
    return this.index >= this.notes.length;
  }

  /** The current note is due from `time` (ms), e.g. once the app has played it. */
  listen(time: number): void {
    this.dueAt = time;
  }

  /** Whether the singing counts at `time` (ms): the current note is due. */
  listening(time: number): boolean {
    return time >= this.dueAt;
  }

  /**
   * A reading at `time` (ms) while waiting at the current note. Returns how far into holding it
   * (0–1), and whether that found it (the music goes on to the next one).
   */
  update(pitch: number | null, time: number, beat: number): { held: number; found: boolean } {
    const note = this.current;
    if (!note || time < this.dueAt) return { held: 0, found: false };
    this.readings.push({ time, beat, pitch });
    const off = pitch === null ? null : centsOff(note.pitch.midi, pitch, this.options.octave);
    const tuned = off !== null && Math.abs(off) <= this.options.cents;
    // Out of tune is held as no note at all (-1), so it breaks the hold.
    const { note: holding, held } = this.hold.update(
      pitch === null ? null : tuned ? note.pitch.midi : -1,
      time,
    );
    const progress = holding === note.pitch.midi ? held : 0;
    if (progress < 1) return { held: progress, found: false };
    this.close(time - this.dueAt);
    return { held: 1, found: true };
  }

  /** Moves on without finding the current note. */
  skip(): void {
    if (this.current) this.close(null);
  }

  results(): SungNote[] {
    return [...this.done];
  }

  private close(tookMs: number | null): void {
    const note = this.current!;
    const off = (pitch: number) => centsOff(note.pitch.midi, pitch, this.options.octave);
    const sung = this.readings.filter((r) => r.pitch !== null);
    const tuned = sung.filter((r) => Math.abs(off(r.pitch!)) <= this.options.cents);
    this.done.push({
      note,
      inTune: sung.length === 0 ? 0 : tuned.length / sung.length,
      startMs: tookMs === null ? null : Math.round(tookMs),
      onTime: null,
      ...pitchStats(this.readings, off),
      credit: tookMs === null ? 0 : tookMs <= MATCH_WITHIN_MS ? 1 : SLOW_CREDIT,
    });
    this.index++;
    this.hold = new HeldNote(WAIT_HOLD_MS);
    this.readings = [];
  }
}

/** A note to work on: how often it was in tune, and how far off (cents, negative = flat). */
export interface NoteToWorkOn {
  midi: number;
  inTune: number;
  offset: number | null;
}

export interface SingSummary {
  accuracy: number;
  stars: 0 | 1 | 2 | 3;
  /** Share of the notes' time in tune, 0–1. */
  inTune: number;
  /** Share of the notes started on time; null waiting for each note. */
  onTime: number | null;
  /** Share of the sung time steady; null when too little was sung. */
  steady: number | null;
  notes: SungNote[];
  /** Each pitch once, low to high: often out of tune, or flat or sharp on average. */
  toWorkOn: NoteToWorkOn[];
  /** Which way most notes leaned, flat or sharp, if they did. */
  lean: PitchLean | null;
}

export function singSummary(notes: readonly SungNote[]): SingSummary {
  const accuracy = accuracyOf(
    notes.reduce((sum, note) => sum + note.credit, 0),
    0,
    notes.length,
  );
  const timed = notes.filter((note) => note.onTime !== null);
  const steady = notes.flatMap((note) => (note.steady === null ? [] : [note.steady]));
  const byPitch = new Map<number, SungNote[]>();
  for (const note of notes) {
    const midi = note.note.pitch.midi;
    byPitch.set(midi, [...(byPitch.get(midi) ?? []), note]);
  }
  const toWorkOn = [...byPitch]
    .map(([midi, sung]): NoteToWorkOn => {
      const offsets = sung.flatMap((note) => (note.offset === null ? [] : [note.offset]));
      return {
        midi,
        inTune: average(sung.map((note) => note.inTune)),
        offset: offsets.length === 0 ? null : Math.round(average(offsets)),
      };
    })
    .filter((note) => note.inTune < WORK_ON_IN_TUNE || Math.abs(note.offset ?? 0) > IN_TUNE_CENTS)
    .sort((a, b) => a.midi - b.midi);
  return {
    accuracy,
    stars: starsFor(accuracy),
    inTune: notes.length === 0 ? 0 : average(notes.map((note) => note.inTune)),
    onTime: timed.length === 0 ? null : timed.filter((note) => note.onTime).length / timed.length,
    steady: steady.length === 0 ? null : average(steady),
    notes: [...notes],
    toWorkOn,
    lean: pitchLean(notes.map((note) => note.offset)),
  };
}

/** How in tune a note was, for its color: mostly, partly, or hardly. */
export const TuneLevel = {
  Good: 'good',
  Partly: 'partly',
  Off: 'off',
} as const;
export type TuneLevel = (typeof TuneLevel)[keyof typeof TuneLevel];

export function tuneLevel(note: SungNote): TuneLevel {
  if (note.credit >= FULL_CREDIT) return TuneLevel.Good;
  return note.credit >= 0.4 ? TuneLevel.Partly : TuneLevel.Off;
}

const average = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
