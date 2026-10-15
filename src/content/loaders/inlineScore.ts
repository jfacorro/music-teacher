/**
 * Loads inline JSON scores (PLAN.md §7):
 *
 *   { "tempo": 100, "timeSignature": [4, 4], "markings": ["moderato", "mf"],
 *     "notes": [{ "note": "E4", "start": 0, "duration": 1, "hand": "R", "finger": 3 }, …],
 *     "dynamics": [{ "beat": 0, "mark": "p" }, { "beat": 8, "mark": "f" }],
 *     "hairpins": [{ "from": 4, "to": 8, "kind": "crescendo" }] }
 *
 * Validates everything once at load time and reports problems with their location, e.g.
 * `song "ode-to-joy" › notes[3] › note: Invalid note "H4": …`.
 */
import { type Finger, Hand, type Score, type ScoreNote, wholeMeasures } from '../../engine/score';
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
  const dynamics = parseDynamics(data, location);
  return {
    tempo,
    timeSignature,
    notes,
    measures: wholeMeasures(notes, timeSignature),
    ...(markings.length > 0 && { markings }),
    ...(dynamics && { dynamics }),
  };
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
