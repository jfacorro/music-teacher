/**
 * Repeats (PLAN.md milestone 5.5): music written once and played twice, the second time maybe
 * with a different ending. Practice works on the music as played ("unrolled"): every note once
 * per time it's played, so grading, falling notes, recordings and loops need nothing new. Sheet
 * music shows it as written, its cursor going back to the repeat's start when the music does.
 */
import {
  beatsPerMeasure,
  type Form,
  type Measure,
  measureAt,
  type Repeat,
  type Score,
  type ScoreNote,
  type Segment,
} from './score';

const SAME_BEAT = 1e-6;

/** The written stretches in the order they're played, up to the end of the music at `end`. */
export function segmentsOf(repeats: readonly Repeat[], end: number): Segment[] {
  const segments: Segment[] = [];
  let at = 0;
  const play = (from: number, to: number) => {
    if (to <= from + SAME_BEAT) return;
    const last = segments.at(-1);
    // Straight on from the stretch before: one stretch.
    if (last && Math.abs(last.to - from) < SAME_BEAT) last.to = to;
    else segments.push({ from, to, at });
    at += to - from;
  };
  let cursor = 0;
  for (const repeat of repeats) {
    play(cursor, repeat.end);
    if (repeat.endings) {
      const [first, second] = repeat.endings;
      play(repeat.start, first.start);
      play(second.start, second.end);
      cursor = second.end;
    } else {
      play(repeat.start, repeat.end);
      cursor = repeat.end;
    }
  }
  play(cursor, end);
  return segments;
}

/** Where the written music ends: the end of its last bar. */
const writtenEnd = (score: Score) => {
  const last = score.measures.at(-1);
  return last ? last.start + last.length : 0;
};

/** Things with a start and an end, copied into each stretch that plays them. */
function unrollSpans<T>(
  items: readonly T[],
  segments: readonly Segment[],
  start: (item: T) => number,
  end: (item: T) => number,
  moved: (item: T, start: number, end: number) => T,
): T[] {
  return segments.flatMap((segment) => {
    const shift = segment.at - segment.from;
    return items
      .filter(
        (item) => start(item) >= segment.from - SAME_BEAT && start(item) < segment.to - SAME_BEAT,
      )
      .map((item) => moved(item, start(item) + shift, Math.min(end(item), segment.to) + shift));
  });
}

/** The score as played: unchanged without repeats; otherwise unrolled, keeping its form. */
export function unroll(written: Score): Score {
  const repeats = written.repeats ?? [];
  if (repeats.length === 0) return written;
  const segments = segmentsOf(repeats, writtenEnd(written));
  const copies = new Map<ScoreNote, ScoreNote[]>();
  const notes: ScoreNote[] = [];
  for (const segment of segments) {
    const shift = segment.at - segment.from;
    for (const note of written.notes) {
      if (note.start < segment.from - SAME_BEAT || note.start >= segment.to - SAME_BEAT) continue;
      const copy = {
        ...note,
        start: note.start + shift,
        duration: Math.min(note.duration, segment.to - note.start),
      };
      notes.push(copy);
      copies.set(note, [...(copies.get(note) ?? []), copy]);
    }
  }
  notes.sort((a, b) => a.start - b.start || a.pitch.midi - b.pitch.midi);

  const last = segments.at(-1)!;
  const length = beatsPerMeasure(written.timeSignature);
  const count = Math.max(1, Math.round((last.at + last.to - last.from) / length));
  const measures: Measure[] = Array.from({ length: count }, (_, i) => ({
    start: i * length,
    length,
  }));

  // The music as played has no repeat signs of its own.
  const rest: Score = { ...written };
  delete rest.repeats;
  const dynamics = written.dynamics && {
    marks: segments.flatMap((segment) =>
      written
        .dynamics!.marks.filter(
          (mark) => mark.beat >= segment.from - SAME_BEAT && mark.beat < segment.to - SAME_BEAT,
        )
        .map((mark) => ({ ...mark, beat: mark.beat + segment.at - segment.from })),
    ),
    hairpins: unrollSpans(
      written.dynamics.hairpins,
      segments,
      (h) => h.start,
      (h) => h.end,
      (h, start, end) => ({ ...h, start, end }),
    ),
  };
  return {
    ...rest,
    notes,
    measures,
    ...(dynamics && { dynamics }),
    ...(written.slurs && {
      slurs: unrollSpans(
        written.slurs,
        segments,
        (s) => s.start,
        (s) => s.end,
        (s, start, end) => ({ ...s, start, end }),
      ),
    }),
    ...(written.pedal && {
      pedal: unrollSpans(
        written.pedal,
        segments,
        (p) => p.down,
        (p) => p.up,
        (_, down, up) => ({ down, up }),
      ),
    }),
    ...(written.ritardandos && {
      ritardandos: unrollSpans(
        written.ritardandos,
        segments,
        (r) => r.start,
        (r) => r.end,
        (_, start, end) => ({ start, end }),
      ),
    }),
    form: { written, segments, copies },
  };
}

/** Where a beat of the music as played is written (before the start: itself). */
export function writtenBeat(form: Form, beat: number): number {
  const segment = form.segments.findLast((s) => beat >= s.at - SAME_BEAT) ?? form.segments[0];
  return segment ? segment.from + (beat - segment.at) : beat;
}

/** The written bar a bar of the music as played comes from (indexes from 0). */
export function writtenMeasureOf(form: Form, played: Measure): number {
  return measureAt(form.written.measures, writtenBeat(form, played.start) + SAME_BEAT);
}

/** The bar of the music as played where a written bar is first played (indexes from 0). */
export function playedMeasureOf(form: Form, score: Score, written: number): number {
  const start = form.written.measures[written]?.start ?? 0;
  const segment = form.segments.find(
    (s) => start >= s.from - SAME_BEAT && start < s.to - SAME_BEAT,
  );
  return measureAt(score.measures, (segment ? segment.at + start - segment.from : 0) + SAME_BEAT);
}
