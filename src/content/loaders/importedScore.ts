/**
 * An imported song's practice score: the learner's choices (which hand plays each track,
 * transposition, tempo) applied to the music read from the file.
 */
import { Hand, type Score, type ScoreNote, wholeMeasures, type Slur } from '../../engine/score';
import { MIDDLE_C, PIANO_HIGHEST, PIANO_LOWEST, pitchFromMidi } from '../../theory/pitch';
import { type ImportedMusic, suggestHands, TrackHand } from './importedMusic';

export interface ImportOptions {
  /** Who plays each track, in the order of `ImportedMusic.tracks`. */
  hands: TrackHand[];
  /** Semitones up (positive) or down. */
  transpose: number;
  /** Quarter notes per minute. */
  tempo: number;
}

export const TRANSPOSE_LIMIT = 12;
export const TEMPO_MIN = 20;
export const TEMPO_MAX = 300;

export function defaultImportOptions(music: ImportedMusic): ImportOptions {
  return { hands: suggestHands(music.tracks), transpose: 0, tempo: music.tempo };
}

export interface ImportedScore {
  /** Null when no track is played. */
  score: Score | null;
  /** Notes left out because they'd be off the piano's 88 keys after transposing. */
  outOfRange: number;
}

export function importedScore(music: ImportedMusic, options: ImportOptions): ImportedScore {
  const keyFifths = transposeKey(music.keyFifths, options.transpose);
  let outOfRange = 0;
  const notes: ScoreNote[] = [];
  const slurs: Slur[] = [];

  music.tracks.forEach((track, index) => {
    const role = options.hands[index] ?? TrackHand.None;
    if (role === TrackHand.None) return;
    /** A slur open on this track: where it started, and in which hand. */
    let slur: { start: number; hand: Hand } | null = null;
    for (const { pitch, start, duration, finger, articulations, slurs: marks } of track.notes) {
      const midi = pitch.midi + options.transpose;
      if (midi < PIANO_LOWEST || midi > PIANO_HIGHEST) {
        outOfRange++;
        continue;
      }
      const hand = role === TrackHand.Split ? (midi >= MIDDLE_C ? Hand.Right : Hand.Left) : role;
      for (const mark of marks ?? []) {
        if (mark === 'stop' && slur && start > slur.start) {
          slurs.push({ start: slur.start, end: start, hand: slur.hand });
          slur = null;
        } else if (mark === 'start') {
          slur = { start, hand };
        }
      }
      notes.push({
        pitch: options.transpose === 0 ? pitch : pitchFromMidi(midi, { keyFifths }),
        start,
        duration,
        hand,
        ...(finger && options.transpose === 0 && { finger }),
        ...(articulations && { articulations }),
      });
    }
  });

  const playable = oneNotePerKey(notes);
  if (playable.length === 0) return { score: null, outOfRange };
  return {
    score: {
      tempo: options.tempo,
      timeSignature: music.timeSignature,
      keyFifths,
      notes: playable,
      measures: wholeMeasures(playable, music.timeSignature),
      ...(music.dynamics && { dynamics: music.dynamics }),
      ...(slurs.length > 0 && { slurs }),
      ...(music.pedal && { pedal: music.pedal }),
    },
    outOfRange,
  };
}

/**
 * A key can only be pressed once at a time: of notes on the same key that start together, the
 * first track's is kept, and a note ends where the next one on its key starts.
 */
function oneNotePerKey(notes: readonly ScoreNote[]): ScoreNote[] {
  const kept: ScoreNote[] = [];
  const byKey = new Map<number, ScoreNote[]>();
  for (const note of notes) {
    const sameKey = byKey.get(note.pitch.midi);
    if (sameKey) sameKey.push(note);
    else byKey.set(note.pitch.midi, [note]);
  }
  for (const sameKey of byKey.values()) {
    // Stable: of notes that start together, the first track's comes first.
    const sorted = sameKey.sort((a, b) => a.start - b.start);
    sorted.forEach((note, i) => {
      if (i > 0 && note.start === sorted[i - 1]!.start) return;
      const next = sorted.slice(i + 1).find((later) => later.start > note.start);
      kept.push(
        next && next.start < note.start + note.duration
          ? { ...note, duration: next.start - note.start }
          : note,
      );
    });
  }
  return kept.sort((a, b) => a.start - b.start || a.pitch.midi - b.pitch.midi);
}

/** The key signature after transposing, written with at most 6 sharps or 5 flats. */
export function transposeKey(fifths: number, semitones: number): number {
  if (semitones === 0) return fifths;
  // A semitone up moves 7 places along the circle of fifths.
  const position = (((fifths + 7 * semitones) % 12) + 12) % 12;
  return position > 6 ? position - 12 : position;
}
