/**
 * The Tuner page's pictures of the singing, also shown in voice lessons' Match the note: a needle
 * for how far off, and the last few seconds as a line.
 */
import { IN_TUNE_CENTS, TRACE_MS } from '../../engine/tuner';

/** The line of what was sung: semitones shown above and below the note in the middle. */
const ROWS_AROUND = 3;
const ROW_HEIGHT = 16;
const TRACE_WIDTH = 420;
const LABEL_WIDTH = 30;
const TRACE_HEIGHT = (2 * ROWS_AROUND + 1) * ROW_HEIGHT;

export interface TracePoint {
  /** performance.now() ms. */
  time: number;
  /** Exact pitch in semitones, or null when nothing clear was heard. */
  pitch: number | null;
}

/**
 * How far off, as a needle over −`span` to +`span` cents (±50 by default), with the zone that
 * counts (the in-tune ±25 by default) in green.
 */
export function Needle({
  cents,
  zone = IN_TUNE_CENTS,
  span = 50,
}: {
  cents: number;
  zone?: number;
  span?: number;
}) {
  const x = (value: number) => 70 + (Math.max(-span, Math.min(span, value)) / span) * 65;
  return (
    <svg className="tuner__needle" viewBox="0 0 140 34" aria-hidden="true">
      <rect x={5} y={14} width={130} height={8} rx={4} className="tuner__needle-track" />
      <rect
        x={x(-zone)}
        y={14}
        width={x(zone) - x(-zone)}
        height={8}
        className="tuner__needle-zone"
      />
      <line x1={70} y1={8} x2={70} y2={28} className="tuner__needle-center" />
      <polygon
        points={`${x(cents) - 3},6 ${x(cents) + 3},6 ${x(cents)},30`}
        className={Math.abs(cents) <= zone ? 'tuner__needle-in' : 'tuner__needle-off'}
      />
    </svg>
  );
}

/**
 * The last seconds as a line over rows of semitones, centered on the latest note sung, or on the
 * note to sing (`around`), in the octave nearest the singing.
 */
export function Trace({
  points,
  labelFor,
  around,
}: {
  points: readonly TracePoint[];
  labelFor: (midi: number) => string;
  around?: number;
}) {
  const sung = points.filter((point) => point.pitch !== null);
  const last = sung.at(-1)?.pitch ?? null;
  const end = points.at(-1)?.time ?? 0;
  const center =
    around === undefined
      ? last === null
        ? null
        : Math.round(last)
      : around + 12 * Math.round(((last ?? around) - around) / 12);
  const y = (pitch: number) => (center! + ROWS_AROUND + 0.5 - pitch) * ROW_HEIGHT;
  const x = (time: number) =>
    LABEL_WIDTH + ((time - (end - TRACE_MS)) / TRACE_MS) * (TRACE_WIDTH - LABEL_WIDTH);

  // The line breaks where nothing clear was heard.
  const lines: string[] = [];
  let current: string[] = [];
  for (const point of points) {
    if (point.pitch === null || center === null) {
      if (current.length > 1) lines.push(current.join(' '));
      current = [];
    } else {
      current.push(`${x(point.time).toFixed(1)},${y(point.pitch).toFixed(1)}`);
    }
  }
  if (current.length > 1) lines.push(current.join(' '));

  return (
    <svg className="tuner__trace" viewBox={`0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}`} aria-hidden="true">
      {center !== null && (
        <>
          <rect
            x={LABEL_WIDTH}
            y={y(center + 0.25)}
            width={TRACE_WIDTH - LABEL_WIDTH}
            height={ROW_HEIGHT / 2}
            className="tuner__trace-zone"
          />
          {Array.from({ length: 2 * ROWS_AROUND + 1 }, (_, i) => center + ROWS_AROUND - i).map(
            (midi) => (
              <g key={midi}>
                <line
                  x1={LABEL_WIDTH}
                  y1={y(midi)}
                  x2={TRACE_WIDTH}
                  y2={y(midi)}
                  className="tuner__trace-row"
                />
                <text x={0} y={y(midi) + 4} className="tuner__trace-name">
                  {labelFor(midi)}
                </text>
              </g>
            ),
          )}
          {lines.map((line, i) => (
            <polyline key={i} points={line} className="tuner__trace-line" />
          ))}
        </>
      )}
    </svg>
  );
}
