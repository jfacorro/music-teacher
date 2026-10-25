/**
 * Lyrics (PLAN.md milestone 6.6): a syllable on each note of the melody, in each language the
 * song has words in. A song's words are written as text, as in ABC's `w:` lines:
 *
 *   "Twin-kle, twin-kle, | lit-tle star, / how I won-der | what you are!"
 *
 * - spaces part words and hyphens part syllables: each syllable is sung on the next note (`\-`
 *   parts them too, in a word written with a hyphen: "one\-horse");
 * - `_` holds the syllable before over the next note too (a melisma), also within a word:
 *   "per-di-do-_-ta-ba";
 * - `~` joins two words sung on one note (shown with ‿), e.g. "me~ha" in Spanish;
 * - `|` checks that the next syllable starts a bar, and `/` ends a line of the words.
 */
import { transposeScore } from './transpose';
import {
  beatsPerMeasure,
  type Lyric,
  type Score,
  type ScoreNote,
  Syllabic,
  wholeMeasures,
} from './score';

export class LyricsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LyricsError';
  }
}

const BAR = '|';
const LINE = '/';
const HOLD = '_';
/** Joins words sung on one note; shown as the tie below. */
const JOIN = '~';
const JOINED = '‿';
/** Between syllables: a hyphen, or `\-` where the word has one. */
const SYLLABLES = /\\?-/;

/**
 * The syllable sung on each note of `melody` (one note at a time, in order), or null where the
 * syllable before is held. Throws `LyricsError` when they don't line up.
 */
export function parseLyrics(
  text: string,
  melody: readonly ScoreNote[],
  timeSignature: [number, number],
): (Lyric | null)[] {
  const bar = beatsPerMeasure(timeSignature);
  const lyrics: (Lyric | null)[] = [];
  let atBar = false;
  const next = (word: string) => {
    const note = melody[lyrics.length];
    if (!note) {
      throw new LyricsError(`more syllables than notes (${melody.length}), at "${word}"`);
    }
    if (atBar && Math.abs(note.start / bar - Math.round(note.start / bar)) > 1e-9) {
      throw new LyricsError(`"${word}" should start bar ${Math.floor(note.start / bar) + 1}`);
    }
    atBar = false;
  };
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (token === LINE) continue;
    if (token === BAR) {
      atBar = true;
      continue;
    }
    // A word's syllables, and any holds among them.
    const parts = token.split(SYLLABLES).filter(Boolean);
    const syllables = parts.filter((part) => part !== HOLD);
    let index = 0;
    for (const part of parts) {
      next(part);
      if (part === HOLD) {
        const before = lyrics.findLast((lyric) => lyric !== null);
        if (!before) throw new LyricsError('a held syllable before any words');
        before.extend = true;
        lyrics.push(null);
        continue;
      }
      lyrics.push({
        text: part.replaceAll(JOIN, JOINED),
        syllabic:
          syllables.length === 1
            ? Syllabic.Single
            : index === 0
              ? Syllabic.Begin
              : index === syllables.length - 1
                ? Syllabic.End
                : Syllabic.Middle,
      });
      index++;
    }
  }
  if (lyrics.length !== melody.length) {
    throw new LyricsError(`${lyrics.length} syllables for ${melody.length} notes`);
  }
  return lyrics;
}

/** The words as they're read: in lines, without the hyphens and marks. */
export function lyricLines(text: string): string[] {
  return text
    .split(new RegExp(`\\s${LINE}\\s`))
    .map((line) =>
      line
        .split(/\s+/)
        .filter((token) => token && token !== BAR && token !== HOLD)
        .map((word) =>
          word
            .split(/(\\?-)/)
            .filter((part) => part !== HOLD && part !== '-')
            .join('')
            .replaceAll('\\-', '-')
            .replaceAll(JOIN, ' '),
        )
        .join(' '),
    )
    .filter(Boolean);
}

/** A syllable as shown under its note: with a hyphen when the word goes on. */
export function syllableText(lyric: Lyric): string {
  return lyric.syllabic === Syllabic.Begin || lyric.syllabic === Syllabic.Middle
    ? `${lyric.text}-`
    : lyric.text;
}

/** The languages a score has words in, in the order they're written. */
export function lyricLanguages(score: Score): string[] {
  return Object.keys(score.lyrics?.lines ?? {});
}

export interface SongParts {
  /** The notes sung, with their words: the melody alone, one note at a time. */
  melody: Score;
  /** The piano's other notes, to play along. */
  accompaniment: ScoreNote[];
}

/** A song with words, split into the melody that's sung and the piano's accompaniment. */
export function songParts(score: Score): SongParts | null {
  const { lyrics } = score;
  if (!lyrics) return null;
  // A voice has no fingers: the piano's fingering is left out.
  const notes = score.notes
    .filter((note) => note.hand === lyrics.hand)
    .map((note) => {
      const sung = { ...note };
      delete sung.finger;
      return sung;
    });
  return {
    melody: {
      ...score,
      notes,
      measures:
        score.measures.length > 0 ? score.measures : wholeMeasures(notes, score.timeSignature),
    },
    accompaniment: score.notes.filter((note) => note.hand !== lyrics.hand),
  };
}

/**
 * The accompaniment moved along with a melody moved by `semitones`: into the same key, but by
 * whole octaves only as far as needed to stay near where it's written, so it doesn't sink into a
 * rumble (or climb) when the melody moves an octave for the voice.
 */
export function moveAccompaniment(
  score: Score,
  accompaniment: readonly ScoreNote[],
  semitones: number,
): ScoreNote[] {
  if (accompaniment.length === 0) return [];
  const shift = semitones - 12 * Math.round(semitones / 12);
  return transposeScore({ ...score, notes: [...accompaniment] }, shift).notes;
}
