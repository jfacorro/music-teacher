/**
 * Ear training for the voice (PLAN.md milestone 6.4): single notes, intervals and short melodies,
 * placed in the singer's saved range and sung back (or played back on the keyboard, if chosen).
 * Levels open as the voice course teaches what they ask: single notes after matching one note
 * (Unit 2), melodies after steps (Unit 4), intervals after leaps (Unit 5). Melodies move along
 * the major scale, and the minor too once Unit 6 is finished.
 */
import type { VocalRange } from '../engine/vocalRange';
import { dealEvenly, pick, type Random } from '../lib/random';
import type { Unit } from './courses';
import { EarLevel, type EarQuestion, melody, MELODY_LENGTHS, QUESTIONS } from './earTraining';
import { isUnitFinished, type LessonState } from './unlock';

/** The levels the voice has. */
export type VoiceEarLevel =
  typeof EarLevel.Notes | typeof EarLevel.Intervals | typeof EarLevel.Melodies;

/** The voice's levels, easiest first. */
export const VOICE_EAR_LEVELS: readonly EarLevel[] = [
  EarLevel.Notes,
  EarLevel.Intervals,
  EarLevel.Melodies,
];

/** Each level opens once this voice unit is finished. */
export const VOICE_EAR_UNITS: Readonly<Partial<Record<EarLevel, string>>> = {
  [EarLevel.Notes]: 'v2',
  [EarLevel.Intervals]: 'v5',
  [EarLevel.Melodies]: 'v4',
};

/** Unit 6 teaches the minor scale: melodies use it from then on. */
const MINOR_UNIT = 'v6';

/** The voice's levels open now, easiest first. */
export function openVoiceEarLevels(
  units: readonly Unit[],
  states: ReadonlyMap<string, LessonState>,
): EarLevel[] {
  const finished = new Set(
    units.filter((unit) => isUnitFinished(unit, states)).map((unit) => unit.id),
  );
  return VOICE_EAR_LEVELS.filter((level) => finished.has(VOICE_EAR_UNITS[level] ?? ''));
}

/** Notes this close to either end of the range are left out when it's wide enough to spare them. */
const EDGE = 2;
/** Intervals start this close to the comfortable note, semitones either side. */
const START_WITHIN = 7;
/** Intervals asked, up or down: up to a fifth (no tritone), and the octave. */
const INTERVALS = [1, 2, 3, 4, 5, 7, 12];
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10, 12];

/** The range questions use: short of its ends when it's wide enough. */
function innerRange(range: VocalRange): { low: number; high: number } {
  const edge = range.high - range.low >= 12 + 2 * EDGE ? EDGE : 0;
  return { low: range.low + edge, high: range.high - edge };
}

const between = (low: number, high: number) =>
  Array.from({ length: Math.max(0, high - low + 1) }, (_, i) => low + i);

const question = (level: EarLevel, notes: readonly number[], given: number | null) => ({
  level,
  reference: null,
  notes,
  given,
  quality: null,
  rhythm: null,
});

/**
 * A new exercise of a level, in the singer's range. `finishedUnits` are the voice units
 * finished (melodies use the minor scale after Unit 6).
 */
export function voiceEarQuestions(
  level: EarLevel,
  range: VocalRange,
  finishedUnits: ReadonlySet<string>,
  random: Random = Math.random,
): EarQuestion[] {
  const { low, high } = innerRange(range);
  const count = QUESTIONS[level];
  switch (level) {
    case EarLevel.Intervals: {
      const starts = between(
        Math.max(low, range.comfortable - START_WITHIN),
        Math.min(high, range.comfortable + START_WITHIN),
      );
      const pairs = starts.flatMap((first) =>
        INTERVALS.flatMap((size) => [first + size, first - size])
          .filter((second) => second >= low && second <= high)
          .map((second) => [first, second] as const),
      );
      return dealEvenly(random, pairs, count, (a, b) => a[0] === b[0] && a[1] === b[1]).map(
        (pair) => question(level, pair, pair[0]),
      );
    }
    case EarLevel.Melodies: {
      const scales = finishedUnits.has(MINOR_UNIT) ? [MAJOR, NATURAL_MINOR] : [MAJOR];
      // The key note that centers the octave's scale on the comfortable note, kept in range.
      const centered = Math.max(low, Math.min(high - 12, range.comfortable - 6));
      return MELODY_LENGTHS.slice(0, count).map((length) => {
        const moves = [-2, -1, 1, 2].filter((move) => fits(centered + move, low, high));
        const keyNote = centered + pick(random, [0, ...moves]);
        const scale = pick(random, scales)
          .map((step) => keyNote + step)
          .filter((note) => note >= low && note <= high);
        const notes = melody(random, scale, length);
        return question(level, notes, notes[0]!);
      });
    }
    default:
      return dealEvenly(random, between(low, high), count).map((note) =>
        question(level, [note], null),
      );
  }
}

/** Whether the octave's scale from `keyNote` is all in range. */
const fits = (keyNote: number, low: number, high: number) => keyNote >= low && keyNote + 12 <= high;
