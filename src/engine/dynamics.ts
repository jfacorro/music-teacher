/**
 * Dynamics (PLAN.md milestone 3.3): how loud the music should be, and how loud it was played.
 *
 * A score marks levels (pp … ff) from a beat on, until the next mark, and hairpins (crescendo,
 * diminuendo) over a stretch of beats. Only a MIDI keyboard reports how hard each key was hit
 * (velocity, 1–127), so only MIDI notes are graded.
 *
 * Keyboards respond differently to touch, so the grading is forgiving: a passage is right if its
 * average velocity is in the level's band, or if it's clearly louder or softer than the passage
 * before, as written. A hairpin is right if its last notes are clearly louder (crescendo) or
 * softer (diminuendo) than its first ones.
 */
import { DYNAMIC_MARKINGS } from './markings';
import type { Measure, ScoreNote } from './score';

export type Dynamic = (typeof DYNAMIC_MARKINGS)[number];

export const HairpinKind = {
  Crescendo: 'crescendo',
  Diminuendo: 'diminuendo',
} as const;
export type HairpinKind = (typeof HairpinKind)[keyof typeof HairpinKind];

export interface DynamicMark {
  beat: number;
  dynamic: Dynamic;
}

export interface Hairpin {
  start: number;
  end: number;
  kind: HairpinKind;
}

export interface ScoreDynamics {
  /** Sorted by beat. */
  marks: DynamicMark[];
  /** Sorted by start; they don't overlap. */
  hairpins: Hairpin[];
}

/** Velocities that sound like each level on most keyboards (overlapping on purpose). */
export const DYNAMIC_BANDS: Readonly<Record<Dynamic, readonly [number, number]>> = {
  pp: [1, 45],
  p: [1, 60],
  mp: [40, 75],
  mf: [55, 90],
  f: [75, 127],
  ff: [90, 127],
};

/** "Clearly louder or softer": the smallest velocity difference that counts. */
export const MIN_CONTRAST = 10;

export const Loudness = {
  TooSoft: 'tooSoft',
  Right: 'right',
  TooLoud: 'tooLoud',
} as const;
export type Loudness = (typeof Loudness)[keyof typeof Loudness];

/** A stretch of music under one level, as played. */
export interface PassageResult {
  dynamic: Dynamic;
  /** Index of the bar it starts in (0 = first). */
  bar: number;
  /** Average velocity of its notes. */
  velocity: number;
  loudness: Loudness;
  ok: boolean;
}

export interface HairpinResult {
  kind: HairpinKind;
  /** Bars it spans, by index (0 = first), both included. */
  firstBar: number;
  lastBar: number;
  /** Average velocity of its first and last notes. */
  from: number;
  to: number;
  ok: boolean;
}

export interface DynamicsSummary {
  passages: PassageResult[];
  hairpins: HairpinResult[];
  /** Every passage and hairpin was played as written. */
  ok: boolean;
}

/** The level in effect at `beat` (null before the first mark). */
export function dynamicAt(dynamics: ScoreDynamics, beat: number): Dynamic | null {
  let current: Dynamic | null = null;
  for (const mark of dynamics.marks) {
    if (mark.beat > beat) break;
    current = mark.dynamic;
  }
  return current;
}

/** The hairpin `beat` is in, if any (start included, end excluded). */
export function hairpinAt(dynamics: ScoreDynamics, beat: number): Hairpin | null {
  return dynamics.hairpins.find((hairpin) => beat >= hairpin.start && beat < hairpin.end) ?? null;
}

export function loudnessOf(velocity: number, dynamic: Dynamic): Loudness {
  const [low, high] = DYNAMIC_BANDS[dynamic];
  return velocity < low ? Loudness.TooSoft : velocity > high ? Loudness.TooLoud : Loudness.Right;
}

const LEVELS: readonly Dynamic[] = DYNAMIC_MARKINGS;
const average = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * How the dynamics went, from the velocity of each note played on a MIDI keyboard. Null when
 * the score has no dynamics or no note has a velocity (e.g. played through the microphone).
 */
export function summarizeDynamics(
  dynamics: ScoreDynamics | undefined,
  notes: readonly ScoreNote[],
  velocities: ReadonlyMap<ScoreNote, number>,
  measures: readonly Measure[],
): DynamicsSummary | null {
  if (!dynamics || (dynamics.marks.length === 0 && dynamics.hairpins.length === 0)) return null;
  const played = notes.filter((note) => velocities.has(note));
  if (played.length === 0) return null;
  const velocityOf = (note: ScoreNote) => velocities.get(note)!;
  const barOf = (beat: number) => {
    const index = measures.findIndex((measure) => beat < measure.start + measure.length);
    return index < 0 ? measures.length - 1 : index;
  };

  // Passages: from each mark to the next, leaving out the notes of hairpins (on their way
  // from one level to another).
  const passages: PassageResult[] = [];
  dynamics.marks.forEach((mark, i) => {
    const end = dynamics.marks[i + 1]?.beat ?? Infinity;
    const inside = played.filter(
      (note) => note.start >= mark.beat && note.start < end && !hairpinAt(dynamics, note.start),
    );
    if (inside.length === 0) return;
    const velocity = average(inside.map(velocityOf));
    const loudness = loudnessOf(velocity, mark.dynamic);
    const previous = passages.at(-1);
    const step = previous
      ? Math.sign(LEVELS.indexOf(mark.dynamic) - LEVELS.indexOf(previous.dynamic))
      : 0;
    const contrast =
      previous !== undefined && step !== 0 && (velocity - previous.velocity) * step >= MIN_CONTRAST;
    passages.push({
      dynamic: mark.dynamic,
      bar: barOf(mark.beat),
      velocity,
      loudness,
      ok: loudness === Loudness.Right || contrast,
    });
  });

  const hairpins: HairpinResult[] = dynamics.hairpins.flatMap((hairpin) => {
    const inside = played.filter(
      (note) => note.start >= hairpin.start && note.start <= hairpin.end,
    );
    if (inside.length < 2) return [];
    const third = Math.max(1, Math.ceil(inside.length / 3));
    const from = average(inside.slice(0, third).map(velocityOf));
    const to = average(inside.slice(-third).map(velocityOf));
    const direction = hairpin.kind === HairpinKind.Crescendo ? 1 : -1;
    return [
      {
        kind: hairpin.kind,
        firstBar: barOf(hairpin.start),
        lastBar: barOf(Math.max(hairpin.start, hairpin.end - 1e-6)),
        from,
        to,
        ok: (to - from) * direction >= MIN_CONTRAST,
      },
    ];
  });

  if (passages.length === 0 && hairpins.length === 0) return null;
  return {
    passages,
    hairpins,
    ok: passages.every((passage) => passage.ok) && hairpins.every((hairpin) => hairpin.ok),
  };
}
