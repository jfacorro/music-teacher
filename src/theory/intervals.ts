/**
 * Intervals as they're written: the note an interval above another, spelled from the letters it
 * spans (a major third above D is F♯, and above E♭ it's G). Matching goes by MIDI number, but
 * theory questions name and show their notes (PLAN.md milestone 7.1).
 */
import { IntervalName } from './chords';
import { type Alter, makePitch, midiFor, type Pitch, type Step, STEPS } from './pitch';

/** An interval's number: how many note names it spans, counting both ends. */
export const IntervalNumber = {
  Second: 'second',
  Third: 'third',
  Fourth: 'fourth',
  Fifth: 'fifth',
  Sixth: 'sixth',
  Seventh: 'seventh',
  Eighth: 'eighth',
} as const;
export type IntervalNumber = (typeof IntervalNumber)[keyof typeof IntervalNumber];

const NAMES_SPANNED: Readonly<Record<IntervalNumber, number>> = {
  [IntervalNumber.Second]: 2,
  [IntervalNumber.Third]: 3,
  [IntervalNumber.Fourth]: 4,
  [IntervalNumber.Fifth]: 5,
  [IntervalNumber.Sixth]: 6,
  [IntervalNumber.Seventh]: 7,
  [IntervalNumber.Eighth]: 8,
};

/** Each interval's number, and how many half steps wide it is. */
const SIZES: Readonly<Record<IntervalName, readonly [IntervalNumber, number]>> = {
  [IntervalName.MinorSecond]: [IntervalNumber.Second, 1],
  [IntervalName.MajorSecond]: [IntervalNumber.Second, 2],
  [IntervalName.MinorThird]: [IntervalNumber.Third, 3],
  [IntervalName.MajorThird]: [IntervalNumber.Third, 4],
  [IntervalName.PerfectFourth]: [IntervalNumber.Fourth, 5],
  [IntervalName.Tritone]: [IntervalNumber.Fourth, 6],
  [IntervalName.PerfectFifth]: [IntervalNumber.Fifth, 7],
  [IntervalName.MinorSixth]: [IntervalNumber.Sixth, 8],
  [IntervalName.MajorSixth]: [IntervalNumber.Sixth, 9],
  [IntervalName.MinorSeventh]: [IntervalNumber.Seventh, 10],
  [IntervalName.MajorSeventh]: [IntervalNumber.Seventh, 11],
  [IntervalName.Octave]: [IntervalNumber.Eighth, 12],
};

/** The note name `number` lands on, counting up from `from`. */
function nameAbove(from: Pitch, number: IntervalNumber): { step: Step; octave: number } {
  const index = STEPS.indexOf(from.step) + NAMES_SPANNED[number] - 1;
  return { step: STEPS[index % STEPS.length]!, octave: from.octave + Math.floor(index / 7) };
}

/** The note an interval's number lands on, without sharps or flats (a third above D is F). */
export function numberAbove(from: Pitch, number: IntervalNumber): Pitch {
  const { step, octave } = nameAbove(from, number);
  return makePitch(step, 0, octave);
}

/**
 * The note an interval above `from`, spelled by its number.
 * @throws RangeError when that would take more than a double sharp or flat
 */
export function intervalAbove(from: Pitch, interval: IntervalName): Pitch {
  const [number, halfSteps] = SIZES[interval];
  const { step, octave } = nameAbove(from, number);
  const alter = from.midi + halfSteps - midiFor(step, 0, octave);
  if (Math.abs(alter) > 2) throw new RangeError(`No ${interval} above ${from.step}${from.alter}`);
  return makePitch(step, alter as Alter, octave);
}
