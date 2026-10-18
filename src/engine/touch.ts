/**
 * Touch (PLAN.md milestone 5.1): how each key was played, beyond which one and when. Staccato
 * notes short, slurred notes connected, accents louder, tenuto notes held. Measured on a MIDI
 * keyboard only (the microphone can't tell when a key is let go), in real time, so it works
 * whether the music waits or plays along.
 */
import {
  Articulation,
  beatsToMs,
  measureAt,
  type Measure,
  type Score,
  type ScoreNote,
  slurNotes,
} from './score';

export const TouchKind = {
  Staccato: 'staccato',
  Legato: 'legato',
  Accent: 'accent',
  Tenuto: 'tenuto',
} as const;
export type TouchKind = (typeof TouchKind)[keyof typeof TouchKind];

const KINDS: readonly TouchKind[] = Object.values(TouchKind);

/** A key as played: when it went down and up (performance.now() ms), and how hard (1–127). */
export interface KeyTouch {
  down: number;
  up: number | null;
  velocity: number;
}

export interface TouchCheck {
  kind: TouchKind;
  /** The bar it's in, from 0. */
  bar: number;
  ok: boolean;
}

export interface TouchKindResult {
  kind: TouchKind;
  right: number;
  total: number;
}

export interface TouchSummary {
  /** The kinds the music asked for, in a fixed order. */
  kinds: TouchKindResult[];
  /** Bars (from 0) where something wasn't played as written. */
  bars: number[];
  /** Each kind mostly right (see `PASS_SHARE`). */
  ok: boolean;
}

/** Staccato: let go within this share of the note's written length. */
const STACCATO_SHARE = 0.5;
/** Tenuto: held at least this share of it. */
const TENUTO_SHARE = 0.85;
/** Legato: a gap up to this between one key going up and the next going down (ms). */
const LEGATO_GAP_MS = 40;
/** Accent: at least this much harder (MIDI velocity) than the notes around it. */
const ACCENT_LOUDER = 10;
/** A kind passes when this share of its notes were right. */
export const PASS_SHARE = 0.75;

/**
 * Each check the music asks for, for the notes played (with a key's down and up known):
 * `tempo` (quarter notes per minute) turns written lengths into real time.
 */
export function touchChecks(
  score: Score,
  notes: readonly ScoreNote[],
  touches: ReadonlyMap<ScoreNote, KeyTouch>,
  tempo: number,
  measures: readonly Measure[] = score.measures,
): TouchCheck[] {
  const checks: TouchCheck[] = [];
  const check = (kind: TouchKind, note: ScoreNote, ok: boolean) =>
    checks.push({ kind, bar: measureAt(measures, note.start), ok });
  const held = (touch: KeyTouch) => (touch.up ?? Infinity) - touch.down;

  for (const note of notes) {
    const touch = touches.get(note);
    if (!touch) continue;
    const written = beatsToMs(note.duration, tempo);
    const articulations = note.articulations ?? [];
    if (articulations.includes(Articulation.Staccato)) {
      check(TouchKind.Staccato, note, held(touch) <= written * STACCATO_SHARE);
    }
    if (articulations.includes(Articulation.Tenuto)) {
      check(TouchKind.Tenuto, note, held(touch) >= written * TENUTO_SHARE);
    }
    if (articulations.includes(Articulation.Accent)) {
      const around = neighbors(notes, note).flatMap((other) => touches.get(other) ?? []);
      if (around.length > 0) {
        const usual = around.reduce((sum, other) => sum + other.velocity, 0) / around.length;
        check(TouchKind.Accent, note, touch.velocity >= usual + ACCENT_LOUDER);
      }
    }
  }

  // Legato: each key of a slur held until the next one goes down. A key played again can't be
  // held into itself (it has to come up first), so a repeated note isn't checked.
  const practiced = new Set(notes);
  for (const slur of score.slurs ?? []) {
    const groups = byStart(slurNotes(score.notes, slur).filter((note) => practiced.has(note)));
    groups.slice(0, -1).forEach((group, i) => {
      const next = groups[i + 1]!;
      const pitches = new Set(group.map((note) => note.pitch.midi));
      if (next.some((note) => pitches.has(note.pitch.midi))) return;
      const ups = group.flatMap((note) => touches.get(note) ?? []);
      const downs = next.flatMap((note) => touches.get(note) ?? []);
      if (ups.length === 0 || downs.length === 0) return;
      const lastUp = Math.max(...ups.map((touch) => touch.up ?? Infinity));
      const nextDown = Math.min(...downs.map((touch) => touch.down));
      check(TouchKind.Legato, group[0]!, lastUp >= nextDown - LEGATO_GAP_MS);
    });
  }
  return checks;
}

/** How the touch went; null when there was nothing to check (no marks, or no MIDI keyboard). */
export function summarizeTouch(
  score: Score,
  notes: readonly ScoreNote[],
  touches: ReadonlyMap<ScoreNote, KeyTouch>,
  tempo: number,
  measures: readonly Measure[] = score.measures,
): TouchSummary | null {
  const checks = touchChecks(score, notes, touches, tempo, measures);
  if (checks.length === 0) return null;
  const kinds = KINDS.flatMap((kind) => {
    const ofKind = checks.filter((check) => check.kind === kind);
    return ofKind.length === 0
      ? []
      : [{ kind, right: ofKind.filter((check) => check.ok).length, total: ofKind.length }];
  });
  return {
    kinds,
    bars: [...new Set(checks.filter((check) => !check.ok).map((check) => check.bar))].sort(
      (a, b) => a - b,
    ),
    ok: kinds.every(({ right, total }) => right / total >= PASS_SHARE - 1e-9),
  };
}

/** Notes starting together, in order. */
function byStart(notes: readonly ScoreNote[]): ScoreNote[][] {
  const groups: ScoreNote[][] = [];
  for (const note of notes) {
    const last = groups.at(-1);
    if (last && Math.abs(last[0]!.start - note.start) < 1e-6) last.push(note);
    else groups.push([note]);
  }
  return groups;
}

/** The notes just before and after, in the same hand, without an accent of their own. */
function neighbors(notes: readonly ScoreNote[], note: ScoreNote): ScoreNote[] {
  const line = notes.filter((other) => other.hand === note.hand).sort((a, b) => a.start - b.start);
  const before = line.filter((other) => other.start < note.start - 1e-6).at(-1);
  const after = line.find((other) => other.start > note.start + 1e-6);
  return [before, after].filter(
    (other): other is ScoreNote =>
      other !== undefined && !(other.articulations ?? []).includes(Articulation.Accent),
  );
}
