/**
 * The circle of fifths (PLAN.md milestone 7.3): the major keys around it, C at the top and each
 * step clockwise a fifth up, with their relative minors in an inner ring if asked.
 */
import { useTranslation } from 'react-i18next';
import { useNoteNames } from '../../i18n/useNoteNames';
import { keyTonic, Mode } from '../../theory/keys';

/** The signatures around the circle from the top, clockwise: sharps, then flats. */
const SIGNATURES = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];
const SIZE = 240;
const MAJOR_RING = 100;
const MINOR_RING = 66;
const KEY_RADIUS = 17;

export function CircleOfFifths({
  marked = null,
  minors = false,
}: {
  /** The signature of the key to mark. */
  marked?: number | null;
  /** Show the relative minors too. */
  minors?: boolean;
}) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const place = (index: number, ring: number) => {
    const angle = (index / SIGNATURES.length) * 2 * Math.PI - Math.PI / 2;
    return { x: SIZE / 2 + ring * Math.cos(angle), y: SIZE / 2 + ring * Math.sin(angle) };
  };
  const keyName = (fifths: number, mode: Mode) =>
    names.name(keyTonic(fifths, mode), { octave: false });

  return (
    <figure className="circle-fifths">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={t('lesson.circleOfFifths')}>
        {SIGNATURES.map((fifths, index) => {
          const { x, y } = place(index, MAJOR_RING);
          return (
            <g key={fifths} className={fifths === marked ? 'is-marked' : undefined}>
              <circle cx={x} cy={y} r={KEY_RADIUS} />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central">
                {keyName(fifths, Mode.Major)}
              </text>
            </g>
          );
        })}
        {minors &&
          SIGNATURES.map((fifths, index) => {
            const { x, y } = place(index, MINOR_RING);
            return (
              <text
                key={fifths}
                className="circle-fifths__minor"
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {keyName(fifths, Mode.Minor)}
              </text>
            );
          })}
      </svg>
    </figure>
  );
}
