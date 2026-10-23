/**
 * Loads inline JSON scores (PLAN.md §7):
 *
 *   { "tempo": 100, "timeSignature": [4, 4], "markings": ["moderato", "mf"],
 *     "notes": [{ "note": "E4", "start": 0, "duration": 1, "hand": "R", "finger": 3 }, …],
 *     "dynamics": [{ "beat": 0, "mark": "p" }, { "beat": 8, "mark": "f" }],
 *     "hairpins": [{ "from": 4, "to": 8, "kind": "crescendo" }],
 *     "keyFifths": 1,    (key signature: sharps positive, flats negative)
 *     "slurs": [{ "from": 0, "to": 4, "hand": "R" }],   (legato: that hand's notes from-to)
 *     "pedal": [{ "down": 0, "up": 4 }, { "down": 4, "up": 8 }],   (the sustain pedal; a mark
 *     starting where one ends is a pedal change)
 *     "repeats": [{ "from": 0, "to": 16,   (played twice, at bar lines; endings optional:
 *       "endings": [{ "from": 12, "to": 16 }, { "from": 16, "to": 20 }] }],   the first ends at
 *     the repeat sign, the second starts there)
 *     "rit": [{ "from": 28, "to": 32 }] }   (gradually slower, back in tempo after)
 *   A note can have "articulations": ["staccato" | "accent" | "tenuto"], "crossed": true when
 *   its hand crosses over the other to play it (it's written on the other hand's staff), and
 *   "fermata": true (held longer, the music waiting on it).
 *
 * A score with repeats comes back as played (see engine/form.ts › unroll), keeping how it's
 * written.
 *
 * Validates everything once at load time and reports problems with their location, e.g.
 * `song "ode-to-joy" › notes[3] › note: Invalid note "H4": …`.
 */
import {
  Articulation,
  type Finger,
  Hand,
  type PedalMark,
  type Repeat,
  type Ritardando,
  type Score,
  type ScoreNote,
  type Slur,
  wholeMeasures,
} from '../../engine/score';
import { unroll } from '../../engine/form';
import { isMarking, isDynamic, type Marking } from '../../engine/markings';
import { type Hairpin, HairpinKind, type ScoreDynamics } from '../../engine/dynamics';
import { describeValues, isValueOf } from '../../lib/values';
import { InvalidNoteError, parseNote } from '../../theory/pitch';

export class ScoreError extends Error {
  readonly location: string;

  constructor(location: string, message: string) {
    super(`${location}: ${message}`);
    this.name = 'ScoreError';
    this.location = location;
  }
}

const at = (location: string, part: string) => `${location} › ${part}`;

export function parseInlineScore(input: unknown, location: string): Score {
  const data = expectObject(input, location);
  const tempo = expectNumber(data.tempo, at(location, 'tempo'), { min: 1 });
  const timeSignature = parseTimeSignature(data.timeSignature, at(location, 'timeSignature'));

  if (!Array.isArray(data.notes) || data.notes.length === 0) {
    throw new ScoreError(at(location, 'notes'), 'expected a non-empty array');
  }
  const notes = data.notes
    .map((note, index) => parseScoreNote(note, at(location, `notes[${index}]`)))
    .sort((a, b) => a.start - b.start || a.pitch.midi - b.pitch.midi);

  const markings = parseMarkings(data.markings, at(location, 'markings'));
  const slurs = parseSlurs(data.slurs, at(location, 'slurs'));
  const pedal = parsePedal(data.pedal, at(location, 'pedal'));
  const dynamics = parseDynamics(data, location);
  if (
    data.keyFifths !== undefined &&
    !(Number.isInteger(data.keyFifths) && Math.abs(data.keyFifths as number) <= 7)
  ) {
    throw new ScoreError(at(location, 'keyFifths'), 'expected a whole number from -7 to 7');
  }
  const measures = wholeMeasures(notes, timeSignature);
  const end = measures.at(-1)!.start + measures.at(-1)!.length;
  const repeats = parseRepeats(data.repeats, at(location, 'repeats'), end, measures[0]!.length);
  const ritardandos = parseRitardandos(data.rit, at(location, 'rit'), end);
  return unroll({
    tempo,
    timeSignature,
    notes,
    measures,
    ...(markings.length > 0 && { markings }),
    ...(dynamics && { dynamics }),
    ...(data.keyFifths !== undefined && { keyFifths: data.keyFifths as number }),
    ...(slurs.length > 0 && { slurs }),
    ...(pedal.length > 0 && { pedal }),
    ...(repeats.length > 0 && { repeats }),
    ...(ritardandos.length > 0 && { ritardandos }),
  });
}

function parseRepeats(input: unknown, location: string, end: number, bar: number): Repeat[] {
  const atBarLine = (beat: number, where: string) => {
    if (Math.abs(beat / bar - Math.round(beat / bar)) > 1e-9) {
      throw new ScoreError(where, `expected a bar line (a multiple of ${bar})`);
    }
    if (beat > end + 1e-9) throw new ScoreError(where, 'after the end of the music');
    return beat;
  };
  const span = (item: unknown, where: string) => {
    const data = expectObject(item, where);
    const start = atBarLine(
      expectNumber(data.from, at(where, 'from'), { min: 0 }),
      at(where, 'from'),
    );
    const stop = atBarLine(
      expectNumber(data.to, at(where, 'to'), { min: start, exclusive: true }),
      at(where, 'to'),
    );
    return { data, start, end: stop };
  };
  let after = 0;
  return list(input, location).map((item, index) => {
    const where = at(location, `[${index}]`);
    const { data, start, end: stop } = span(item, where);
    if (start < after - 1e-9) throw new ScoreError(where, 'repeats must not overlap');
    const repeat: Repeat = { start, end: stop };
    if (data.endings !== undefined) {
      const endings = list(data.endings, at(where, 'endings'));
      if (endings.length !== 2) {
        throw new ScoreError(at(where, 'endings'), 'expected a first and a second ending');
      }
      const first = span(endings[0], at(where, 'endings[0]'));
      const second = span(endings[1], at(where, 'endings[1]'));
      if (first.start <= start || first.end !== stop || second.start !== stop) {
        throw new ScoreError(
          at(where, 'endings'),
          'the first ending ends at the repeat sign, and the second starts there',
        );
      }
      repeat.endings = [
        { start: first.start, end: first.end },
        { start: second.start, end: second.end },
      ];
    }
    after = repeat.endings?.[1].end ?? stop;
    return repeat;
  });
}

function parseRitardandos(input: unknown, location: string, end: number): Ritardando[] {
  let after = 0;
  return list(input, location).map((item, index) => {
    const where = at(location, `[${index}]`);
    const data = expectObject(item, where);
    const start = expectNumber(data.from, at(where, 'from'), { min: after });
    const stop = expectNumber(data.to, at(where, 'to'), { min: start, exclusive: true });
    if (stop > end + 1e-9) throw new ScoreError(at(where, 'to'), 'after the end of the music');
    after = stop;
    return { start, end: stop };
  });
}

function parsePedal(input: unknown, location: string): PedalMark[] {
  const marks = list(input, location).map((item, index) => {
    const where = at(location, `[${index}]`);
    const mark = expectObject(item, where);
    const down = expectNumber(mark.down, at(where, 'down'), { min: 0 });
    const up = expectNumber(mark.up, at(where, 'up'), { min: down, exclusive: true });
    return { down, up };
  });
  marks.sort((a, b) => a.down - b.down);
  marks.forEach((mark, index) => {
    const next = marks[index + 1];
    if (next && next.down < mark.up - 1e-9) {
      throw new ScoreError(location, 'pedal marks must not overlap');
    }
  });
  return marks;
}

function parseSlurs(input: unknown, location: string): Slur[] {
  return list(input, location).map((item, index) => {
    const where = at(location, `[${index}]`);
    const slur = expectObject(item, where);
    const start = expectNumber(slur.from, at(where, 'from'), { min: 0 });
    const end = expectNumber(slur.to, at(where, 'to'), { min: start, exclusive: true });
    if (!isValueOf(Hand, slur.hand)) {
      throw new ScoreError(at(where, 'hand'), `expected ${describeValues(Hand)}`);
    }
    return { start, end, hand: slur.hand };
  });
}

function parseDynamics(data: Record<string, unknown>, location: string): ScoreDynamics | null {
  if (data.dynamics === undefined && data.hairpins === undefined) return null;
  const marks = list(data.dynamics, at(location, 'dynamics')).map((input, index) => {
    const where = at(location, `dynamics[${index}]`);
    const mark = expectObject(input, where);
    const beat = expectNumber(mark.beat, at(where, 'beat'), { min: 0 });
    if (!isMarking(mark.mark) || !isDynamic(mark.mark)) {
      throw new ScoreError(at(where, 'mark'), 'expected a dynamic: pp, p, mp, mf, f or ff');
    }
    return { beat, dynamic: mark.mark };
  });
  const hairpins: Hairpin[] = list(data.hairpins, at(location, 'hairpins')).map((input, index) => {
    const where = at(location, `hairpins[${index}]`);
    const hairpin = expectObject(input, where);
    const start = expectNumber(hairpin.from, at(where, 'from'), { min: 0 });
    const end = expectNumber(hairpin.to, at(where, 'to'), { min: start, exclusive: true });
    if (!isValueOf(HairpinKind, hairpin.kind)) {
      throw new ScoreError(at(where, 'kind'), `expected ${describeValues(HairpinKind)}`);
    }
    return { start, end, kind: hairpin.kind };
  });
  hairpins.sort((a, b) => a.start - b.start);
  hairpins.forEach((hairpin, index) => {
    const next = hairpins[index + 1];
    if (next && next.start < hairpin.end) {
      throw new ScoreError(at(location, 'hairpins'), 'hairpins must not overlap');
    }
  });
  return { marks: marks.sort((a, b) => a.beat - b.beat), hairpins };
}

function list(input: unknown, location: string): unknown[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new ScoreError(location, 'expected an array');
  return input;
}

function parseMarkings(input: unknown, location: string): Marking[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) throw new ScoreError(location, 'expected an array');
  return input.map((marking, index) => {
    if (!isMarking(marking)) {
      throw new ScoreError(at(location, `[${index}]`), `unknown marking "${String(marking)}"`);
    }
    return marking;
  });
}

function parseScoreNote(input: unknown, location: string): ScoreNote {
  const data = expectObject(input, location);

  if (typeof data.note !== 'string') {
    throw new ScoreError(at(location, 'note'), 'expected a note string such as "C4"');
  }
  let pitch;
  try {
    pitch = parseNote(data.note);
  } catch (error) {
    if (error instanceof InvalidNoteError)
      throw new ScoreError(at(location, 'note'), error.message);
    throw error;
  }

  const start = expectNumber(data.start, at(location, 'start'), { min: 0 });
  const duration = expectNumber(data.duration, at(location, 'duration'), {
    min: 0,
    exclusive: true,
  });

  if (!isValueOf(Hand, data.hand)) {
    throw new ScoreError(at(location, 'hand'), `expected ${describeValues(Hand)}`);
  }
  const hand: Hand = data.hand;

  const note: ScoreNote = { pitch, start, duration, hand };
  if (data.finger !== undefined) {
    if (![1, 2, 3, 4, 5].includes(data.finger as number)) {
      throw new ScoreError(at(location, 'finger'), 'expected 1–5');
    }
    note.finger = data.finger as Finger;
  }
  if (data.articulations !== undefined) {
    const articulations = list(data.articulations, at(location, 'articulations'));
    articulations.forEach((item, index) => {
      if (!isValueOf(Articulation, item)) {
        throw new ScoreError(
          at(location, `articulations[${index}]`),
          `expected ${describeValues(Articulation)}`,
        );
      }
    });
    if (articulations.length > 0) note.articulations = articulations as Articulation[];
  }
  if (data.crossed !== undefined) {
    if (typeof data.crossed !== 'boolean') {
      throw new ScoreError(at(location, 'crossed'), 'expected true or false');
    }
    if (data.crossed) note.crossed = true;
  }
  if (data.fermata !== undefined) {
    if (typeof data.fermata !== 'boolean') {
      throw new ScoreError(at(location, 'fermata'), 'expected true or false');
    }
    if (data.fermata) note.fermata = true;
  }
  return note;
}

function parseTimeSignature(input: unknown, location: string): [number, number] {
  if (
    !Array.isArray(input) ||
    input.length !== 2 ||
    !input.every((n) => Number.isInteger(n) && n > 0) ||
    ![1, 2, 4, 8, 16, 32].includes(input[1])
  ) {
    throw new ScoreError(location, 'expected [beats, noteValue] such as [4, 4] or [6, 8]');
  }
  return [input[0], input[1]];
}

function expectObject(input: unknown, location: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ScoreError(location, 'expected an object');
  }
  return input as Record<string, unknown>;
}

function expectNumber(
  input: unknown,
  location: string,
  { min, exclusive = false }: { min: number; exclusive?: boolean },
): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    throw new ScoreError(location, 'expected a number');
  }
  if (exclusive ? input <= min : input < min) {
    throw new ScoreError(location, `expected a number ${exclusive ? '>' : '≥'} ${min}`);
  }
  return input;
}
