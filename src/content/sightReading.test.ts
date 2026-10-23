import { describe, expect, it } from 'vitest';
import { Hand } from '../engine/score';
import { HandFilter } from '../engine/session';
import { pitchClass } from '../theory/pitch';
import { UNITS } from './courses';
import {
  DRILL_LEVELS,
  DRILL_UNITS,
  DrillLevel,
  drillTune,
  freshDrillSeed,
  hasLeapAfterLeap,
  makeDrill,
  openDrillLevels,
} from './sightReading';
import { lessonStates } from './unlock';

const lessonFiles = import.meta.glob<unknown>('./lessons/*.json', {
  eager: true,
  import: 'default',
});

/**
 * What the lessons up to (and including) a unit teach: the notes each hand reads or plays (a
 * quiz's clef says which hand reads it), note values and keys.
 */
function taughtUpTo(unitId: string) {
  const last = UNITS.findIndex((unit) => unit.id === unitId);
  const lessons = new Set(
    UNITS.slice(0, last + 1).flatMap((unit) => unit.lessons.map((l) => l.id)),
  );
  const notes = { [Hand.Right]: new Set<string>(), [Hand.Left]: new Set<string>() };
  const durations = new Set<number>();
  const keys = new Set<number>([0]);
  const handsFor = (clef: unknown): Hand[] =>
    clef === 'treble' ? [Hand.Right] : clef === 'bass' ? [Hand.Left] : [Hand.Right, Hand.Left];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const data = value as Record<string, unknown>;
    if (typeof data.note === 'string' && (data.hand === Hand.Right || data.hand === Hand.Left)) {
      notes[data.hand].add(data.note);
      if (typeof data.duration === 'number') durations.add(data.duration);
    }
    if (Array.isArray(data.notes) && data.notes.every((note) => typeof note === 'string')) {
      for (const hand of handsFor(data.clef)) {
        for (const note of data.notes as string[]) notes[hand].add(note);
      }
    }
    if (typeof data.keyFifths === 'number') keys.add(data.keyFifths);
    Object.values(data).forEach(walk);
  };
  for (const [path, lesson] of Object.entries(lessonFiles)) {
    if (lessons.has(path.slice('./lessons/'.length, -'.json'.length))) walk(lesson);
  }
  return { notes, durations, keys };
}

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);
const spelled = (pitch: { step: string; alter: number; octave: number }) =>
  `${pitch.step}${pitch.alter > 0 ? '#' : pitch.alter < 0 ? 'b' : ''}${pitch.octave}`;

describe('drill levels', () => {
  it('open with the units that teach them', () => {
    const doneUpTo = (unitId: string | null) => {
      const last = unitId ? UNITS.findIndex((unit) => unit.id === unitId) : -1;
      const done = new Set(
        UNITS.slice(0, last + 1).flatMap((unit) => unit.lessons.map((l) => l.id)),
      );
      return lessonStates(UNITS, (id) => (done.has(id) ? 1 : 0));
    };
    expect(openDrillLevels(UNITS, doneUpTo(null))).toEqual([]);
    expect(openDrillLevels(UNITS, doneUpTo('u2'))).toEqual([]);
    expect(openDrillLevels(UNITS, doneUpTo('u3'))).toEqual([
      DrillLevel.Treble,
      DrillLevel.TrebleRhythm,
    ]);
    expect(openDrillLevels(UNITS, doneUpTo('u5'))).toEqual([
      DrillLevel.Treble,
      DrillLevel.TrebleRhythm,
      DrillLevel.Bass,
      DrillLevel.HandsTogether,
    ]);
    expect(openDrillLevels(UNITS, doneUpTo('u8'))).toEqual([
      DrillLevel.Treble,
      DrillLevel.TrebleRhythm,
      DrillLevel.Bass,
      DrillLevel.HandsTogether,
      DrillLevel.Keys,
      DrillLevel.Accidentals,
    ]);
    expect(openDrillLevels(UNITS, doneUpTo('u12'))).toEqual(DRILL_LEVELS);
  });

  it('name units of the course', () => {
    const ids = UNITS.map((unit) => unit.id);
    for (const level of DRILL_LEVELS) expect(ids).toContain(DRILL_UNITS[level]);
  });
});

describe('makeDrill', () => {
  it.each(DRILL_LEVELS)('only uses what has been taught by then (%s)', (level) => {
    const taught = taughtUpTo(DRILL_UNITS[level]);
    for (const seed of SEEDS) {
      const { score } = makeDrill(level, seed);
      for (const note of score.notes) {
        expect(taught.notes[note.hand], `seed ${seed}`).toContain(spelled(note.pitch));
        expect(taught.durations, `seed ${seed}`).toContain(note.duration);
      }
      expect(taught.keys).toContain(score.keyFifths ?? 0);
    }
  });

  it.each(DRILL_LEVELS)('writes four bars of 4/4 that end on the key note (%s)', (level) => {
    for (const seed of SEEDS) {
      const { score, minor } = makeDrill(level, seed);
      expect(score.timeSignature).toEqual([4, 4]);
      expect(score.measures).toHaveLength(4);
      const melody = score.notes.filter((note) => note.duration < 4 || note.start === 0);
      const last = score.notes.filter((note) => note.start + note.duration === 16);
      expect(last.length).toBeGreaterThan(0);
      // The major key's note, or its relative minor's.
      const tonic = ((((score.keyFifths ?? 0) * 7 + (minor ? 9 : 0)) % 12) + 12) % 12;
      for (const note of last) expect(pitchClass(note.pitch.midi)).toBe(tonic);
      expect(melody[0]?.finger).toBeDefined();
    }
  });

  it.each(DRILL_LEVELS)('moves mostly by step, a fourth at most (%s)', (level) => {
    let steps = 0;
    let moves = 0;
    for (const seed of SEEDS) {
      const drill = makeDrill(level, seed);
      const hand = drill.hands === HandFilter.Left ? Hand.Left : Hand.Right;
      const tune = drill.score.notes.filter((note) => note.hand === hand).map((n) => n.pitch.midi);
      tune.slice(1).forEach((midi, i) => {
        const interval = Math.abs(midi - tune[i]!);
        expect(interval, `seed ${seed}`).toBeLessThanOrEqual(5);
        moves++;
        if (interval <= 2) steps++;
      });
    }
    expect(steps / moves).toBeGreaterThan(0.6);
  });

  it('never leaps twice in a row', () => {
    expect(hasLeapAfterLeap([0, 2, 4])).toBe(true);
    expect(hasLeapAfterLeap([0, 2, 1, 3])).toBe(false);
  });

  it('puts some rests and eighth notes in each drill past the first level', () => {
    for (const seed of SEEDS) {
      const { score } = makeDrill(DrillLevel.TrebleRhythm, seed);
      expect(score.notes.some((note) => note.duration === 0.5)).toBe(true);
      const played = score.notes.reduce((sum, note) => sum + note.duration, 0);
      expect(played, `seed ${seed}`).toBeLessThan(16);
    }
  });

  it('keeps the first level to quarter, half and whole notes', () => {
    for (const seed of SEEDS) {
      const { score } = makeDrill(DrillLevel.Treble, seed);
      for (const note of score.notes) expect([1, 2, 4]).toContain(note.duration);
    }
  });

  it('accompanies hands-together drills with a bass note per bar, home at both ends', () => {
    for (const seed of SEEDS) {
      const drill = makeDrill(DrillLevel.HandsTogether, seed);
      expect(drill.hands).toBe(HandFilter.Both);
      const bass = drill.score.notes.filter((note) => note.hand === Hand.Left);
      expect(bass.map((note) => [note.start, note.duration])).toEqual([
        [0, 4],
        [4, 4],
        [8, 4],
        [12, 4],
      ]);
      expect(spelled(bass[0]!.pitch)).toBe('C3');
      expect(spelled(bass[3]!.pitch)).toBe('C3');
    }
  });

  it('writes the key signature and its sharp or flat in the keys level', () => {
    const keys = new Set<number>();
    for (const seed of SEEDS) {
      const { score } = makeDrill(DrillLevel.Keys, seed);
      keys.add(score.keyFifths ?? 0);
      for (const note of score.notes) {
        if (score.keyFifths === 1) expect(note.pitch.step === 'F' ? note.pitch.alter : 1).toBe(1);
        if (score.keyFifths === -1) {
          expect(note.pitch.step === 'B' ? note.pitch.alter : -1).toBe(-1);
        }
      }
    }
    expect([...keys].sort()).toEqual([-1, 1]);
  });

  it('writes one or two neighbor notes, a sharp a half step below, clear of the ending', () => {
    for (const seed of SEEDS) {
      const { score } = makeDrill(DrillLevel.Accidentals, seed);
      const tune = score.notes;
      const sharps = tune.flatMap((note, i) => (note.pitch.alter === 1 ? [i] : []));
      expect(sharps.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(sharps.length, `seed ${seed}`).toBeLessThanOrEqual(2);
      for (const i of sharps) {
        const [before, after] = [tune[i - 1]!, tune[i + 1]!];
        expect(before.pitch.midi - tune[i]!.pitch.midi, `seed ${seed}`).toBe(1);
        expect(after.pitch.midi, `seed ${seed}`).toBe(before.pitch.midi);
        expect(i, `seed ${seed}`).toBeLessThan(tune.length - 2);
      }
    }
  });

  it('plays every key of Unit 12, major and minor, in the more keys level', () => {
    const keys = new Set<string>();
    for (const seed of SEEDS) {
      const { score, minor } = makeDrill(DrillLevel.MoreKeys, seed);
      keys.add(`${score.keyFifths ?? 0}${minor ? 'm' : ''}`);
    }
    expect([...keys].sort()).toEqual(['-1m', '-2', '0m', '1m', '2']);
  });

  it('gives the same drill for the same seed, and fresh ones for others', () => {
    expect(drillTune(makeDrill(DrillLevel.Bass, 42))).toBe(
      drillTune(makeDrill(DrillLevel.Bass, 42)),
    );
    for (const level of DRILL_LEVELS) {
      const tunes = new Set(SEEDS.map((seed) => drillTune(makeDrill(level, seed))));
      expect(tunes.size).toBe(SEEDS.length);
    }
  });
});

describe('freshDrillSeed', () => {
  it('skips seeds that would repeat a recent drill', () => {
    const values = [42 / 2 ** 32, 1234 / 2 ** 32];
    const random = () => values.shift() ?? 0.5;
    expect(freshDrillSeed(DrillLevel.Treble, [42], random)).toBe(1234);
  });
});
