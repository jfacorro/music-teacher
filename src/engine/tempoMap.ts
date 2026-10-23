/**
 * How fast the music goes at each beat, against its tempo (PLAN.md milestone 5.5): gradually
 * slower through a ritardando, and held on a fermata. The transport turns beats into time with
 * it, so playing along, the metronome, the other hand and listening all follow.
 */
import { beatsToMs, msToBeats, type Score } from './score';

/** A fermata holds its notes twice as long as written. */
export const FERMATA_HOLD = 2;
/** A ritardando slows down to this share of the tempo, by its end. */
export const RIT_SLOWEST = 0.6;
/** A ritardando slows down in steps this long (beats). */
const RIT_STEP = 0.25;

/** From `from` to `to` (beats), the music goes at `speed` times its tempo. */
interface Span {
  from: number;
  to: number;
  speed: number;
}

export class TempoMap {
  static readonly NONE = new TempoMap([]);

  /** Sorted, not overlapping; everywhere else the speed is 1. */
  private readonly spans: readonly Span[];

  constructor(spans: readonly Span[]) {
    this.spans = [...spans].sort((a, b) => a.from - b.from);
  }

  /** Milliseconds from beat `from` to beat `to` at `tempo` (negative when `to` comes first). */
  msBetween(from: number, to: number, tempo: number): number {
    if (to < from) return -this.msBetween(to, from, tempo);
    let ms = 0;
    let at = from;
    for (const span of this.spans) {
      if (span.to <= at) continue;
      if (span.from >= to) break;
      if (span.from > at) {
        ms += beatsToMs(span.from - at, tempo);
        at = span.from;
      }
      const until = Math.min(span.to, to);
      ms += beatsToMs(until - at, tempo * span.speed);
      at = until;
    }
    return ms + beatsToMs(to - at, tempo);
  }

  /** The beat `ms` milliseconds after beat `from` (before it, when negative) at `tempo`. */
  beatAfter(from: number, ms: number, tempo: number): number {
    if (this.spans.length === 0 || ms === 0) return from + msToBeats(ms, tempo);
    const forward = ms > 0;
    let left = Math.abs(ms);
    let at = from;
    for (;;) {
      const { speed, boundary } = this.around(at, forward);
      const toBoundary = Number.isFinite(boundary)
        ? beatsToMs(Math.abs(boundary - at), tempo * speed)
        : Infinity;
      if (toBoundary >= left) {
        const beats = msToBeats(left, tempo * speed);
        return forward ? at + beats : at - beats;
      }
      left -= toBoundary;
      at = boundary;
    }
  }

  /** The speed going on from `at` (forward or back), and where it next changes. */
  private around(at: number, forward: boolean): { speed: number; boundary: number } {
    const inside = this.spans.find((span) =>
      forward ? span.from <= at && at < span.to : span.from < at && at <= span.to,
    );
    if (inside) return { speed: inside.speed, boundary: forward ? inside.to : inside.from };
    const next = forward
      ? this.spans.find((span) => span.from >= at)?.from
      : this.spans.findLast((span) => span.to <= at)?.to;
    return { speed: 1, boundary: next ?? (forward ? Infinity : -Infinity) };
  }
}

/** The tempo map of a score (as played): its fermatas and ritardandos. */
export function tempoMapOf(score: Score): TempoMap {
  // Each fermata holds the notes starting with it, as long as the longest of them.
  const fermatas = new Map<number, number>();
  for (const note of score.notes) {
    if (note.fermata) {
      fermatas.set(note.start, Math.max(fermatas.get(note.start) ?? 0, note.duration));
    }
  }
  const holds = [...fermatas].map(([from, duration]) => ({ from, to: from + duration }));
  const rits = score.ritardandos ?? [];
  if (holds.length === 0 && rits.length === 0) return TempoMap.NONE;

  // Cut the music where any of them starts, ends or slows a step, then work out each piece.
  const edges = new Set<number>();
  for (const { from, to } of holds) edges.add(from).add(to);
  for (const { start, end } of rits) {
    for (let beat = start; beat < end; beat += RIT_STEP) edges.add(beat);
    edges.add(end);
  }
  const sorted = [...edges].sort((a, b) => a - b);
  const spans: Span[] = [];
  sorted.slice(0, -1).forEach((from, i) => {
    const to = sorted[i + 1]!;
    const middle = (from + to) / 2;
    let speed = 1;
    if (holds.some((hold) => middle > hold.from && middle < hold.to)) speed /= FERMATA_HOLD;
    const rit = rits.find((r) => middle > r.start && middle < r.end);
    if (rit) speed *= 1 - (1 - RIT_SLOWEST) * ((middle - rit.start) / (rit.end - rit.start));
    if (speed !== 1) spans.push({ from, to, speed });
  });
  return new TempoMap(spans);
}
