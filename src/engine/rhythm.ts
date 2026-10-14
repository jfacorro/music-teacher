/**
 * Rhythm patterns (PLAN.md §2.5), written the way they're counted: note values separated by
 * spaces and bars by "|", e.g. "q q h | e e q rq q".
 *
 * - w, h, q, e, s: whole, half, quarter, eighth and sixteenth notes;
 * - a trailing "." makes it dotted ("h." = 3 beats); a leading "r" makes it a rest ("rq").
 *
 * Every bar must be full. Notes are placed on one pitch, which is where a one-line rhythm staff
 * draws them.
 */
import { beatsPerMeasure } from './score';

/** On a one-line staff, OpenSheetMusicDisplay draws E4 on the line. */
export const RHYTHM_NOTE = 'E4';

const VALUES: Readonly<Record<string, number>> = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };
const TOKEN = /^(r?)([whqes])(\.?)$/;

export class RhythmError extends Error {}

/** The notes of a pattern (rests left out), in beats. */
export function parseRhythm(
  pattern: string,
  timeSignature: [number, number],
): { start: number; duration: number }[] {
  const bar = beatsPerMeasure(timeSignature);
  const notes: { start: number; duration: number }[] = [];
  const bars = pattern.split('|').map((text) => text.trim());
  if (bars.every((text) => text === '')) throw new RhythmError('the pattern is empty');

  let start = 0;
  bars.forEach((text, index) => {
    let length = 0;
    for (const token of text.split(/\s+/).filter(Boolean)) {
      const match = TOKEN.exec(token);
      if (!match) {
        throw new RhythmError(
          `bar ${index + 1}: "${token}" isn't a note value (w h q e s, "." dotted, "r" rest)`,
        );
      }
      const [, rest, value, dot] = match;
      const duration = VALUES[value!]! * (dot ? 1.5 : 1);
      if (!rest) notes.push({ start: start + length, duration });
      length += duration;
    }
    if (Math.abs(length - bar) > 1e-9) {
      throw new RhythmError(`bar ${index + 1} lasts ${length} beats instead of ${bar}`);
    }
    start += bar;
  });
  return notes;
}
