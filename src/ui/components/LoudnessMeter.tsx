const MAX_VELOCITY = 127;

const position = (velocity: number) =>
  `${(Math.min(MAX_VELOCITY, Math.max(0, velocity)) / MAX_VELOCITY) * 100}%`;

/**
 * How hard notes were played, on a soft-to-loud scale (MIDI velocity 0–127): the target band
 * shaded, a dot per value; with two values, a line from the first (hollow) to the second.
 * Decorative: the verdict next to it says the same in words.
 */
export function LoudnessMeter({
  band,
  values,
}: {
  band?: readonly [number, number];
  values: readonly number[];
}) {
  const [from, to] = values;
  return (
    <span className="loudness" aria-hidden="true">
      {band && (
        <span
          className="loudness__band"
          style={{ left: position(band[0]), right: `calc(100% - ${position(band[1])})` }}
        />
      )}
      {from !== undefined && to !== undefined && (
        <span
          className="loudness__line"
          style={{
            left: position(Math.min(from, to)),
            right: `calc(100% - ${position(Math.max(from, to))})`,
          }}
        />
      )}
      {values.map((value, index) => (
        <span
          key={index}
          className={
            index < values.length - 1 ? 'loudness__dot loudness__dot--start' : 'loudness__dot'
          }
          style={{ left: position(value) }}
        />
      ))}
    </span>
  );
}
