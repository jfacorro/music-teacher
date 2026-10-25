import { useTranslation } from 'react-i18next';
import { scoreEnd, type Score } from '../../../engine/score';
import type { TrailPoint } from '../../../engine/singSession';
import { isBlackKey } from '../../../theory/pitch';
import { laneRows } from './laneRows';

/** Pixels per beat and per semitone. */
const BEAT = 48;
const ROW = 16;
const LABELS = 40;

interface SingCompareProps {
  score: Score;
  trail: readonly TrailPoint[];
  labelFor: (midi: number) => string;
}

/**
 * A sung run over the melody (PLAN.md milestone 6.3): the written notes as gray bars on rows of
 * semitones, and the line of the voice drawn over them, green in tune and amber off.
 */
export function SingCompare({ score, trail, labelFor }: SingCompareProps) {
  const { t } = useTranslation('screens');
  const { low, high } = laneRows(score.notes);
  const end = scoreEnd(score);
  const width = LABELS + end * BEAT + 8;
  const height = (high - low + 1) * ROW;
  const x = (beat: number) => LABELS + beat * BEAT;
  const y = (pitch: number) => (high + 0.5 - pitch) * ROW;

  // The line in stretches of one color, broken where nothing clear was heard.
  const stretches: { points: string[]; inTune: boolean | null }[] = [];
  let current: (typeof stretches)[number] | null = null;
  for (const point of trail) {
    if (point.beat < 0 || point.beat > end || point.pitch === null) {
      current = null;
      continue;
    }
    const xy = `${x(point.beat).toFixed(1)},${y(point.pitch).toFixed(1)}`;
    if (current && current.inTune === point.inTune) {
      current.points.push(xy);
      continue;
    }
    // A new color starts where the last one ended, so the line stays joined.
    current = { points: current ? [current.points.at(-1)!, xy] : [xy], inTune: point.inTune };
    stretches.push(current);
  }

  return (
    <>
      <div className="compare__scroll" role="img" aria-label={t('sing.compareLabel')}>
        <svg
          className="compare__chart"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
        >
          {Array.from({ length: high - low + 1 }, (_, i) => high - i).map((midi) => (
            <g key={midi}>
              {isBlackKey(midi) && (
                <rect
                  x={LABELS}
                  y={y(midi) - ROW / 2}
                  width={width - LABELS}
                  height={ROW}
                  className="compare__row--black"
                />
              )}
              <text x={LABELS - 6} y={y(midi) + 4} textAnchor="end" className="compare__label">
                {labelFor(midi)}
              </text>
            </g>
          ))}
          {score.measures.map((measure) => (
            <line
              key={measure.start}
              x1={x(measure.start)}
              y1={0}
              x2={x(measure.start)}
              y2={height}
              className="compare__bar"
            />
          ))}
          {score.notes.map((note) => (
            <rect
              key={note.start}
              x={x(note.start) + 1}
              y={y(note.pitch.midi) - ROW * 0.35}
              width={note.duration * BEAT - 2}
              height={ROW * 0.7}
              rx={4}
              className="compare__written"
            />
          ))}
          {stretches.map((stretch, i) => (
            <polyline
              key={i}
              points={stretch.points.join(' ')}
              className={
                stretch.inTune === null
                  ? 'sing-compare__voice'
                  : stretch.inTune
                    ? 'sing-compare__voice is-in-tune'
                    : 'sing-compare__voice is-off'
              }
            />
          ))}
        </svg>
      </div>
      <ul className="compare__legend">
        <li>
          <span className="compare__swatch compare__swatch--written" /> {t('sing.legend.written')}
        </li>
        <li>
          <span className="compare__swatch sing-compare__swatch is-in-tune" />{' '}
          {t('sing.legend.inTune')}
        </li>
        <li>
          <span className="compare__swatch sing-compare__swatch is-off" /> {t('sing.legend.off')}
        </li>
      </ul>
    </>
  );
}
