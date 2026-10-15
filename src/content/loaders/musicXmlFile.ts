/**
 * MusicXML (.musicxml / .xml, "partwise" as notation programs write it) → `ImportedMusic`:
 * one track per staff of each part, notes with their written spelling and fingering, tied
 * notes joined into one.
 *
 * Grace notes, cue notes and unpitched (percussion) notes are left out. Repeats are played
 * once, as written. A pickup bar is padded to a whole bar, so the bars line up with the time
 * signature.
 */
import { beatsPerMeasure, type Finger } from '../../engine/score';
import { type Alter, makePitch, type Pitch, type Step, STEPS } from '../../theory/pitch';
import {
  type ImportedMusic,
  type ImportedNote,
  type ImportedTrack,
  ImportError,
  ImportErrorCode,
  ImportFormat,
  ImportWarning,
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

  // The continuation of a tied note only makes it longer.
  const open = tied.get(key);
  if (ties.includes('stop') && open && Math.abs(open.start + open.duration - start) < EPSILON) {
    open.duration += duration;
    if (!ties.includes('start')) tied.delete(key);
    return;
  }

  const note: ImportedNote = { pitch, start, duration };
  const finger = fingerOf(item);
  if (finger) note.finger = finger;
  const notes = part.staves.get(staff) ?? [];
  notes.push(note);
  part.staves.set(staff, notes);
  if (ties.includes('start')) tied.set(key, note);
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

function durationOf(item: Element, divisions: number): number {
  return (numberOf(childOf(item, 'duration')) ?? 0) / divisions;
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
