/**
 * Music read from a MIDI or MusicXML file (PLAN.md milestone 3.2), before the learner chooses
 * which hand plays each track, a transposition and a tempo (`importedScore.ts`).
 *
 * Positions and durations are in beats (quarter notes), rounded to sixteenth notes: the finest
 * value the sheet music writes (`musicxml.ts`).
 */
import type { ScoreDynamics } from '../../engine/dynamics';
import { type Finger, Hand, type Articulation, type PedalMark } from '../../engine/score';
import { MIDDLE_C, type Pitch } from '../../theory/pitch';

export interface ImportedNote {
  pitch: Pitch;
  start: number;
  duration: number;
  finger?: Finger;
  articulations?: Articulation[];
  /** Slurs starting or stopping on it (MusicXML), in order: stops first. */
  slurs?: ('start' | 'stop')[];
}

export interface ImportedTrack {
  /** As written in the file (user content, never translated); null when it has none. */
  name: string | null;
  /** MusicXML: the staff within its part (1 = top) when the part has several. */
  staff: number | null;
  notes: ImportedNote[];
}

export const ImportFormat = {
  Midi: 'midi',
  MusicXml: 'musicxml',
} as const;
export type ImportFormat = (typeof ImportFormat)[keyof typeof ImportFormat];

/** Things the file has that the practice score leaves out or simplifies. */
export const ImportWarning = {
  /** Notes were moved to the nearest sixteenth note (triplets, or a recorded performance). */
  TimingRounded: 'timingRounded',
  /** The tempo changes during the piece: the first one is used. */
  TempoChanges: 'tempoChanges',
  /** The time signature changes during the piece: bars follow the first one. */
  TimeSignatureChanges: 'timeSignatureChanges',
  /** Repeat signs and endings are played once, as written. */
  RepeatsIgnored: 'repeatsIgnored',
} as const;
export type ImportWarning = (typeof ImportWarning)[keyof typeof ImportWarning];

export interface ImportedMusic {
  format: ImportFormat;
  title: string | null;
  composer: string | null;
  /** Quarter notes per minute. */
  tempo: number;
  timeSignature: [number, number];
  /** As in MusicXML `<fifths>`: negative = flats. */
  keyFifths: number;
  /** Only tracks with notes; at least one. */
  tracks: ImportedTrack[];
  warnings: ImportWarning[];
  /** Loud and soft, as written (MusicXML only; songs saved before this have none). */
  dynamics?: ScoreDynamics;
  /** The sustain pedal, as written (MusicXML only; songs saved before this have none). */
  pedal?: PedalMark[];
}

export const ImportErrorCode = {
  /** Not a MIDI, MusicXML or compressed MusicXML file. */
  UnknownFormat: 'unknownFormat',
  /** The right kind of file, but damaged or in a form this app can't read. */
  Unreadable: 'unreadable',
  NoNotes: 'noNotes',
  TooLarge: 'tooLarge',
} as const;
export type ImportErrorCode = (typeof ImportErrorCode)[keyof typeof ImportErrorCode];

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'ImportError';
    this.code = code;
  }
}

/** Sixteenth notes, in beats. */
export const IMPORT_GRID = 0.25;
/** Moving a note by less than this (in beats) doesn't count as rounding. */
const ROUNDING_TOLERANCE = 0.001;

const snap = (beats: number) => Math.round(beats / IMPORT_GRID) * IMPORT_GRID;

/** Notes moved onto the sixteenth-note grid; `rounded` when any of them moved noticeably. */
export function quantize(notes: readonly ImportedNote[]): {
  notes: ImportedNote[];
  rounded: boolean;
} {
  let rounded = false;
  const snapped = notes.map((note) => {
    const end = note.start + note.duration;
    const start = snap(note.start);
    const snappedEnd = snap(end);
    if (
      Math.abs(start - note.start) > ROUNDING_TOLERANCE ||
      Math.abs(snappedEnd - end) > ROUNDING_TOLERANCE
    ) {
      rounded = true;
    }
    return { ...note, start, duration: Math.max(IMPORT_GRID, snappedEnd - start) };
  });
  return { notes: snapped, rounded };
}

/** Which hand plays a track: one of them, both (split at middle C), or neither. */
export const TrackHand = {
  Right: Hand.Right,
  Left: Hand.Left,
  Split: 'split',
  None: 'none',
} as const;
export type TrackHand = (typeof TrackHand)[keyof typeof TrackHand];

/** A track with this share of its notes on each side of middle C is split between the hands. */
const SPLIT_SHARE = 0.1;

/**
 * A first guess at who plays what, which the learner can change:
 * - a part on two staves (a piano part): the top staff is the right hand, the bottom the left;
 * - otherwise the highest track is the right hand, the lowest the left, the rest are left out;
 * - a single track is split at middle C if it has notes on both sides, otherwise it goes to the
 *   hand on its side.
 */
export function suggestHands(tracks: readonly ImportedTrack[]): TrackHand[] {
  const hands: TrackHand[] = tracks.map(() => TrackHand.None);
  if (tracks.length === 0) return hands;

  if (tracks.length === 1) {
    const notes = tracks[0]!.notes;
    const below = notes.filter((note) => note.pitch.midi < MIDDLE_C).length / notes.length;
    hands[0] =
      below >= SPLIT_SHARE && 1 - below >= SPLIT_SHARE
        ? TrackHand.Split
        : below > 0.5
          ? TrackHand.Left
          : TrackHand.Right;
    return hands;
  }

  const pair = tracks.findIndex(
    (track, i) =>
      track.staff === 1 && tracks[i + 1]?.staff === 2 && tracks[i + 1]?.name === track.name,
  );
  if (pair >= 0) {
    hands[pair] = TrackHand.Right;
    hands[pair + 1] = TrackHand.Left;
    return hands;
  }

  const byHeight = tracks
    .map((track, index) => ({ index, height: averagePitch(track) }))
    .sort((a, b) => b.height - a.height);
  hands[byHeight[0]!.index] = TrackHand.Right;
  hands[byHeight.at(-1)!.index] = TrackHand.Left;
  return hands;
}

function averagePitch(track: ImportedTrack): number {
  return track.notes.reduce((sum, note) => sum + note.pitch.midi, 0) / track.notes.length;
}

/** Lowest and highest MIDI note of a track. */
export function trackRange(track: ImportedTrack): { lowest: number; highest: number } {
  const midis = track.notes.map((note) => note.pitch.midi);
  return { lowest: Math.min(...midis), highest: Math.max(...midis) };
}
