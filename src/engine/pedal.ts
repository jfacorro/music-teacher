/**
 * The sustain pedal (PLAN.md milestone 5.2): pressed and lifted where the music marks it, and up
 * for the notes outside the marks. Measured on a MIDI keyboard only (its pedal sends control
 * change 64), in real time, so it works whether the music waits or plays along.
 *
 * - Down: from a quarter of a beat before the mark to half a beat after it (or to the next note,
 *   if that comes sooner). At a pedal change, also after the new notes are played: lifting as
 *   they sound and pressing again just after joins the chords without blurring them (legato
 *   pedaling).
 * - Up: in the same window around the mark's end. An end at the end of the music isn't checked:
 *   the last notes may ring on.
 * - Without the pedal: a note outside the marks (and the windows around them) starts with the
 *   pedal up.
 */
import {
  hasPedalMarks,
  measureAt,
  type Measure,
  type PedalMark,
  type Score,
  type ScoreNote,
  scoreEnd,
} from './score';
import type { KeyTouch } from './touch';

export const PedalKind = {
  Down: 'down',
  Up: 'up',
  Off: 'off',
} as const;
export type PedalKind = (typeof PedalKind)[keyof typeof PedalKind];

const KINDS: readonly PedalKind[] = Object.values(PedalKind);

/** The pedal going down or up: when (performance.now() ms), and where in the music (beats). */
export interface PedalPress {
  down: boolean;
  time: number;
  beat: number;
}

export interface PedalCheck {
  kind: PedalKind;
  /** The bar it's in, from 0. */
  bar: number;
  ok: boolean;
}

export interface PedalKindResult {
  kind: PedalKind;
  right: number;
  total: number;
}

export interface PedalSummary {
  /** The kinds checked, in a fixed order. */
  kinds: PedalKindResult[];
  /** Bars (from 0) where the pedal wasn't used as written. */
  bars: number[];
  /** Each kind mostly right (see `PEDAL_PASS_SHARE`). */
  ok: boolean;
  /** The pedal wasn't heard at all: it may not be plugged in. */
  silent: boolean;
}

/** The pedal may go down or up this long before its mark (beats)… */
const EARLY_BEATS = 0.25;
/** …and this long after it, unless the next note comes sooner. */
const LATE_BEATS = 0.5;
/** A kind passes when this share of its checks were right. */
export const PEDAL_PASS_SHARE = 0.75;
const SAME_BEAT = 1e-6;

/**
 * Each check the marks ask for. `notes`: the notes practiced, in order, with the keys played on a
 * MIDI keyboard in `touches`; `presses`: the pedal during the run, in order; `end`: where the
 * music ends.
 */
export function pedalChecks(
  marks: readonly PedalMark[],
  notes: readonly ScoreNote[],
  touches: ReadonlyMap<ScoreNote, KeyTouch>,
  presses: readonly PedalPress[],
  end: number,
  measures: readonly Measure[],
): PedalCheck[] {
  const checks: PedalCheck[] = [];
  const check = (kind: PedalKind, beat: number, ok: boolean) =>
    checks.push({ kind, bar: measureAt(measures, beat), ok });
  /** The latest the pedal may go down or up for a mark at `beat`. */
  const lateUntil = (beat: number) => {
    const next = notes.find((note) => note.start > beat + SAME_BEAT)?.start ?? Infinity;
    return beat + Math.min(LATE_BEATS, next - beat);
  };
  const used = new Set<PedalPress>();
  /** The first press not counted yet going `down` (or up) around `beat`, after `after` ms. */
  const take = (down: boolean, beat: number, after: number) => {
    const press = presses.find(
      (p) =>
        !used.has(p) &&
        p.down === down &&
        p.time > after &&
        p.beat >= beat - EARLY_BEATS - SAME_BEAT &&
        p.beat <= lateUntil(beat) + SAME_BEAT,
    );
    if (press) used.add(press);
    return press;
  };
  /** When the first key of the notes starting at `beat` went down, if any was played. */
  const playedAt = (beat: number) => {
    const downs = notes
      .filter((note) => Math.abs(note.start - beat) < SAME_BEAT)
      .flatMap((note) => touches.get(note)?.down ?? []);
    return downs.length > 0 ? Math.min(...downs) : -Infinity;
  };

  let lastUp = -Infinity;
  marks.forEach((mark, i) => {
    const change = i > 0 && Math.abs(marks[i - 1]!.up - mark.down) < SAME_BEAT;
    // At a change, down again only once the new notes sound.
    const after = change ? Math.max(lastUp, playedAt(mark.down)) : -Infinity;
    const down = take(true, mark.down, after);
    check(PedalKind.Down, mark.down, down !== undefined);
    if (mark.up >= end - SAME_BEAT) return;
    const up = take(false, mark.up, down?.time ?? -Infinity);
    check(PedalKind.Up, mark.up, up !== undefined);
    lastUp = up?.time ?? -Infinity;
  });

  // Notes outside the marks, and away from where the pedal goes down or up, start without it.
  const pedaled = (note: ScoreNote) =>
    marks.some(
      (mark) =>
        note.start >= mark.down - EARLY_BEATS - SAME_BEAT &&
        note.start < lateUntil(mark.up) - SAME_BEAT,
    );
  for (const note of notes) {
    const touch = touches.get(note);
    if (!touch || pedaled(note)) continue;
    const before = presses.filter((press) => press.time <= touch.down).at(-1);
    check(PedalKind.Off, note.start, !before?.down);
  }
  return checks;
}

/**
 * How the pedal went; null when there was nothing to check: no pedal marks, or no MIDI keyboard
 * (no keys with a known touch).
 */
export function summarizePedal(
  score: Score,
  notes: readonly ScoreNote[],
  touches: ReadonlyMap<ScoreNote, KeyTouch>,
  presses: readonly PedalPress[],
  measures: readonly Measure[] = score.measures,
): PedalSummary | null {
  if (!hasPedalMarks(score) || touches.size === 0) return null;
  const checks = pedalChecks(score.pedal ?? [], notes, touches, presses, scoreEnd(score), measures);
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
    ok: kinds.every(({ right, total }) => right / total >= PEDAL_PASS_SHARE - 1e-9),
    silent: presses.length === 0,
  };
}
