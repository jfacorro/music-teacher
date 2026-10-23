/**
 * MusicXML (.musicxml / .xml, "partwise" as notation programs write it) → `ImportedMusic`:
 * one track per staff of each part, notes with their written spelling and fingering, tied
 * notes joined into one.
 *
 * Dynamics, articulations, slurs and pedal marks are kept. Grace notes, cue notes and unpitched
 * (percussion) notes are left out. Repeats are played
 * once, as written. A pickup bar is padded to a whole bar, so the bars line up with the time
 * signature.
 */
import {
  type DynamicMark,
  type Hairpin,
  HairpinKind,
  type ScoreDynamics,
} from '../../engine/dynamics';
import { isDynamic, isMarking } from '../../engine/markings';
import { beatsPerMeasure, type Finger, Articulation, type PedalMark } from '../../engine/score';
import { type Alter, makePitch, type Pitch, type Step, STEPS } from '../../theory/pitch';
import {
  type ImportedMusic,
  type ImportedNote,
  type ImportedTrack,
  ImportError,
  ImportErrorCode,
  ImportFormat,
  ImportWarning,
  IMPORT_GRID,
  quantize,
} from './importedMusic';

/** When the file doesn't give a tempo: a moderate one (the learner can change it). */
const DEFAULT_TEMPO = 100;
const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];
/** Positions closer than this (in beats) are the same. */
const EPSILON = 0.001;

/** Note values of a metronome mark, in quarter notes. */
const BEAT_UNITS: Readonly<Record<string, number>> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
};

/** What all the parts share: the first time and key signatures, tempos, repeats. */
interface Context {
  timeSignature: [number, number] | null;
  keyFifths: number | null;
  meters: Set<string>;
  tempos: number[];
  repeats: boolean;
  /** Dynamics and hairpins as written, in beats (before padding a pickup bar). */
  marks: DynamicMark[];
  hairpins: Hairpin[];
  /** Pedal marks as written, in beats (before padding a pickup bar). */
  pedal: PedalMark[];
}

interface Part {
  name: string | null;
  /** Declared number of staves. */
  staffCount: number;
  /** Notes by staff number. */
  staves: Map<number, ImportedNote[]>;
  /** Length of the first bar, in beats (shorter than a whole bar for a pickup). */
  firstBar: number | null;
}

export function parseMusicXml(text: string): ImportedMusic {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new ImportError(ImportErrorCode.Unreadable, 'not well-formed XML');
  }
  const root = doc.documentElement;
  if (root.tagName === 'score-timewise') {
    throw new ImportError(ImportErrorCode.Unreadable, 'timewise MusicXML');
  }
  if (root.tagName !== 'score-partwise') {
    throw new ImportError(ImportErrorCode.UnknownFormat, `<${root.tagName}>`);
  }

  const partNames = new Map(
    childrenOf(childOf(root, 'part-list'), 'score-part').map((part) => [
      part.getAttribute('id'),
      textOf(childOf(part, 'part-name')),
    ]),
  );
  const context: Context = {
    timeSignature: null,
    keyFifths: null,
    meters: new Set(),
    tempos: [],
    repeats: false,
    marks: [],
    hairpins: [],
    pedal: [],
  };
  const parts = childrenOf(root, 'part').map((part, index) =>
    readPart(part, partNames.get(part.getAttribute('id')) ?? null, context, index === 0),
  );

  const timeSignature = context.timeSignature ?? DEFAULT_TIME_SIGNATURE;
  const barLength = beatsPerMeasure(timeSignature);
  const firstBar = parts[0]?.firstBar ?? barLength;
  const pickup = firstBar > EPSILON && firstBar < barLength - EPSILON ? barLength - firstBar : 0;

  let rounded = false;
  const tracks: ImportedTrack[] = [];
  for (const part of parts) {
    for (const [staff, notes] of [...part.staves].sort(([a], [b]) => a - b)) {
      if (notes.length === 0) continue;
      const quantized = quantize(
        notes
          .map((note) => ({ ...note, start: note.start + pickup }))
          .sort((a, b) => a.start - b.start || a.pitch.midi - b.pitch.midi),
      );
      rounded ||= quantized.rounded;
      tracks.push({
        name: part.name,
        staff: part.staffCount > 1 ? staff : null,
        notes: quantized.notes,
      });
    }
  }
  if (tracks.length === 0) throw new ImportError(ImportErrorCode.NoNotes);

  const warnings: ImportWarning[] = [];
  if (rounded) warnings.push(ImportWarning.TimingRounded);
  if (new Set(context.tempos).size > 1) warnings.push(ImportWarning.TempoChanges);
  if (context.meters.size > 1) warnings.push(ImportWarning.TimeSignatureChanges);
  if (context.repeats) warnings.push(ImportWarning.RepeatsIgnored);

  const work = childOf(root, 'work');
  const composer = childrenOf(childOf(root, 'identification'), 'creator').find(
    (creator) => creator.getAttribute('type') === 'composer',
  );
  return {
    format: ImportFormat.MusicXml,
    title: textOf(childOf(work, 'work-title')) ?? textOf(childOf(root, 'movement-title')),
    composer: textOf(composer),
    tempo: Math.round(context.tempos[0] ?? DEFAULT_TEMPO),
    timeSignature,
    keyFifths: context.keyFifths ?? 0,
    ...dynamicsOf(context, pickup),
    ...pedalOf(context, pickup),
    tracks,
    warnings,
  };
}

function readPart(element: Element, name: string | null, context: Context, first: boolean): Part {
  const part: Part = { name, staffCount: 1, staves: new Map(), firstBar: null };
  let divisions = 1;
  let barStart = 0;
  /** Notes tied over to a following one, by `${staff}|${midi}`. */
  const tied = new Map<string, ImportedNote>();
  /** Where an open crescendo or diminuendo started. */
  let wedge: { start: number; kind: HairpinKind } | null = null;
  /** Where the pedal went down, while it's held. */
  let pedal: number | null = null;

  for (const measure of childrenOf(element, 'measure')) {
    let cursor = 0; // beats from the start of the bar
    let length = 0;
    let chordStart = 0;

    for (const item of measure.children) {
      switch (item.tagName) {
        case 'attributes':
          divisions = readAttributes(item, part, context) ?? divisions;
          break;
        case 'backup':
          cursor -= durationOf(item, divisions);
          break;
        case 'forward':
          cursor += durationOf(item, divisions);
          break;
        case 'direction':
        case 'sound': {
          const tempo = tempoOf(item);
          if (first && tempo !== null) context.tempos.push(tempo);
          if (item.tagName === 'direction') {
            const at = barStart + cursor + durationOf(item, divisions, 'offset');
            wedge = readDynamics(item, at, wedge, context);
            pedal = readPedal(item, at, pedal, context);
          }
          break;
        }
        case 'barline':
          if (childOf(item, 'repeat') || childOf(item, 'ending')) context.repeats = true;
          break;
        case 'note': {
          if (childOf(item, 'grace')) break; // no time of its own
          const duration = durationOf(item, divisions);
          const chord = childOf(item, 'chord') !== undefined;
          const start = chord ? chordStart : cursor;
          if (!chord) {
            chordStart = cursor;
            cursor += duration;
          }
          const pitch = childOf(item, 'cue') ? null : pitchOf(item);
          if (pitch) addNote(item, pitch, barStart + start, duration, part, tied);
          break;
        }
      }
      length = Math.max(length, cursor);
    }

    const fullBar = beatsPerMeasure(context.timeSignature ?? DEFAULT_TIME_SIGNATURE);
    part.firstBar ??= length;
    barStart += length > EPSILON ? length : fullBar;
  }
  return part;
}

function addNote(
  item: Element,
  pitch: Pitch,
  start: number,
  duration: number,
  part: Part,
  tied: Map<string, ImportedNote>,
): void {
  const staff = numberOf(childOf(item, 'staff')) ?? 1;
  const ties = [...childrenOf(item, 'tie'), ...childrenOf(childOf(item, 'notations'), 'tied')].map(
    (tie) => tie.getAttribute('type'),
  );
  const key = `${staff}|${pitch.midi}`;

  const slurs = childrenOf(childOf(item, 'notations'), 'slur')
    .map((slur) => slur.getAttribute('type'))
    .filter((type): type is 'start' | 'stop' => type === 'start' || type === 'stop')
    .sort((a, b) => (a === b ? 0 : a === 'stop' ? -1 : 1));

  // The continuation of a tied note only makes it longer (and may end a slur).
  const open = tied.get(key);
  if (ties.includes('stop') && open && Math.abs(open.start + open.duration - start) < EPSILON) {
    open.duration += duration;
    if (slurs.includes('stop')) open.slurs = [...(open.slurs ?? []), 'stop'];
    if (!ties.includes('start')) tied.delete(key);
    return;
  }

  const note: ImportedNote = { pitch, start, duration };
  const finger = fingerOf(item);
  if (finger) note.finger = finger;
  const articulations = articulationsOf(item);
  if (articulations.length > 0) note.articulations = articulations;
  if (slurs.length > 0) note.slurs = slurs;
  const notes = part.staves.get(staff) ?? [];
  notes.push(note);
  part.staves.set(staff, notes);
  if (ties.includes('start')) tied.set(key, note);
}

/** MusicXML articulations as ours (staccatissimo is staccato; a strong accent, an accent). */
const ARTICULATIONS: Readonly<Record<string, readonly Articulation[]>> = {
  staccato: [Articulation.Staccato],
  staccatissimo: [Articulation.Staccato],
  spiccato: [Articulation.Staccato],
  accent: [Articulation.Accent],
  'strong-accent': [Articulation.Accent],
  tenuto: [Articulation.Tenuto],
  'detached-legato': [Articulation.Tenuto, Articulation.Staccato],
};

function articulationsOf(item: Element): Articulation[] {
  const marks = childOf(childOf(item, 'notations'), 'articulations');
  const found = [...(marks?.children ?? [])].flatMap((mark) => ARTICULATIONS[mark.tagName] ?? []);
  return [...new Set(found)];
}

/** Reads time and key signatures and the staff count; returns the divisions, if given. */
function readAttributes(item: Element, part: Part, context: Context): number | null {
  const time = childOf(item, 'time');
  if (time) {
    const beats = numberOf(childOf(time, 'beats'));
    const beatType = numberOf(childOf(time, 'beat-type'));
    if (
      beats !== null &&
      beatType !== null &&
      Number.isInteger(beats) &&
      beats > 0 &&
      Number.isInteger(Math.log2(beatType))
    ) {
      context.meters.add(`${beats}/${beatType}`);
      context.timeSignature ??= [beats, beatType];
    }
  }
  const fifths = numberOf(childOf(childOf(item, 'key'), 'fifths'));
  if (fifths !== null) context.keyFifths ??= fifths;
  const staves = numberOf(childOf(item, 'staves'));
  if (staves !== null && staves > 0) part.staffCount = staves;
  const divisions = numberOf(childOf(item, 'divisions'));
  return divisions !== null && divisions > 0 ? divisions : null;
}

function pitchOf(item: Element): Pitch | null {
  const pitch = childOf(item, 'pitch');
  if (!pitch) return null; // a rest, or an unpitched (percussion) note
  const step = textOf(childOf(pitch, 'step'));
  const octave = numberOf(childOf(pitch, 'octave'));
  if (!STEPS.includes(step as Step) || octave === null) return null;
  // Microtones are rounded to the nearest semitone.
  const alter = Math.max(-2, Math.min(2, Math.round(numberOf(childOf(pitch, 'alter')) ?? 0)));
  try {
    return makePitch(step as Step, alter as Alter, octave);
  } catch {
    return null; // outside MIDI's range
  }
}

function fingerOf(item: Element): Finger | undefined {
  const fingering = childOf(childOf(childOf(item, 'notations'), 'technical'), 'fingering');
  const finger = Number.parseInt(textOf(fingering) ?? '', 10);
  return finger >= 1 && finger <= 5 ? (finger as Finger) : undefined;
}

/** Quarter notes per minute from a `<sound tempo>` or a metronome mark, if any. */
function tempoOf(item: Element): number | null {
  const sound = item.tagName === 'sound' ? item : childOf(item, 'sound');
  const tempo = Number(sound?.getAttribute('tempo') ?? Number.NaN);
  if (tempo > 0) return tempo;

  const metronome = childOf(childOf(item, 'direction-type'), 'metronome');
  const unit = BEAT_UNITS[textOf(childOf(metronome, 'beat-unit')) ?? ''];
  const perMinute = numberOf(childOf(metronome, 'per-minute'));
  if (!unit || !perMinute || perMinute <= 0) return null;
  return perMinute * unit * (childOf(metronome, 'beat-unit-dot') ? 1.5 : 1);
}

function durationOf(item: Element, divisions: number, child = 'duration'): number {
  return (numberOf(childOf(item, child)) ?? 0) / divisions;
}

/** Reads a direction's dynamics and wedges at `at`; returns the wedge still open. */
function readDynamics(
  direction: Element,
  at: number,
  open: { start: number; kind: HairpinKind } | null,
  context: Context,
): { start: number; kind: HairpinKind } | null {
  let wedge = open;
  for (const type of childrenOf(direction, 'direction-type')) {
    for (const level of childOf(type, 'dynamics')?.children ?? []) {
      if (isMarking(level.tagName) && isDynamic(level.tagName)) {
        context.marks.push({ beat: at, dynamic: level.tagName });
      }
    }
    const mark = childOf(type, 'wedge');
    const kind = mark?.getAttribute('type');
    if (kind === 'crescendo' || kind === 'diminuendo') {
      wedge = {
        start: at,
        kind: kind === 'crescendo' ? HairpinKind.Crescendo : HairpinKind.Diminuendo,
      };
    } else if (kind === 'stop' && wedge) {
      if (at > wedge.start)
        context.hairpins.push({ start: wedge.start, end: at, kind: wedge.kind });
      wedge = null;
    }
  }
  return wedge;
}

/** Reads a direction's pedal marks at `at`; returns where the pedal is held from, if it is. */
function readPedal(
  direction: Element,
  at: number,
  open: number | null,
  context: Context,
): number | null {
  let down = open;
  for (const type of childrenOf(direction, 'direction-type')) {
    const kind = childOf(type, 'pedal')?.getAttribute('type');
    if ((kind === 'stop' || kind === 'change') && down !== null && at > down) {
      context.pedal.push({ down, up: at });
      down = null;
    }
    if (kind === 'start' || kind === 'change') down = at;
  }
  return down;
}

/** The pedal marks on the sixteenth-note grid, moved like the notes for a pickup bar. */
function pedalOf(context: Context, pickup: number): { pedal?: PedalMark[] } {
  const snap = (beat: number) => Math.round((beat + pickup) / IMPORT_GRID) * IMPORT_GRID;
  const pedal: PedalMark[] = [];
  for (const mark of [...context.pedal].sort((a, b) => a.down - b.down)) {
    const down = snap(mark.down);
    const up = snap(mark.up);
    const previous = pedal.at(-1);
    if (up > down && (!previous || down >= previous.up)) pedal.push({ down, up });
  }
  return pedal.length > 0 ? { pedal } : {};
}

/**
 * The dynamics on the sixteenth-note grid, moved like the notes for a pickup bar: one level
 * per beat (the last written), hairpins that don't overlap.
 */
function dynamicsOf(context: Context, pickup: number): { dynamics?: ScoreDynamics } {
  const snap = (beat: number) => Math.round((beat + pickup) / IMPORT_GRID) * IMPORT_GRID;
  const byBeat = new Map<number, DynamicMark>();
  for (const mark of context.marks) {
    byBeat.set(snap(mark.beat), { beat: snap(mark.beat), dynamic: mark.dynamic });
  }
  const marks = [...byBeat.values()].sort((a, b) => a.beat - b.beat);
  const hairpins: Hairpin[] = [];
  for (const hairpin of [...context.hairpins].sort((a, b) => a.start - b.start)) {
    const start = snap(hairpin.start);
    const end = snap(hairpin.end);
    const previous = hairpins.at(-1);
    if (end > start && (!previous || start >= previous.end)) {
      hairpins.push({ start, end, kind: hairpin.kind });
    }
  }
  return marks.length > 0 || hairpins.length > 0 ? { dynamics: { marks, hairpins } } : {};
}

function childrenOf(element: Element | undefined, name: string): Element[] {
  return element ? [...element.children].filter((child) => child.tagName === name) : [];
}

function childOf(element: Element | undefined, name: string): Element | undefined {
  return element ? [...element.children].find((child) => child.tagName === name) : undefined;
}

function textOf(element: Element | undefined): string | null {
  return element?.textContent?.trim() || null;
}

function numberOf(element: Element | undefined): number | null {
  const text = textOf(element);
  const value = text === null ? Number.NaN : Number(text);
  return Number.isFinite(value) ? value : null;
}
