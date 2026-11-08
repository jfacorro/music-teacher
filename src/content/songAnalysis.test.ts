/**
 * Songs' harmony (PLAN.md milestone 7.4) is written by hand: these check it against the notes, so
 * a lesson never shows a chord the song doesn't play.
 */
import { describe, expect, it } from 'vitest';
import { chordAt, chordBefore, chordIn, type SongAnalysis } from '../engine/harmony';
import { Hand, type Score, type ScoreNote } from '../engine/score';
import { Cadence, Numeral } from '../engine/theoryQuestions';
import { transposeScore } from '../engine/transpose';
import { formatNote, pitchClass } from '../theory/pitch';
import { parseInlineScore } from './loaders/inlineScore';
import { loadSong, type SongId } from './songs';

/** The songs whose harmony is written: lessons use them, and all but Brahms' Lullaby are sung too. */
const ANALYZED: readonly SongId[] = [
  'ode-to-joy',
  'au-clair-de-la-lune',
  'when-the-saints',
  'jingle-bells',
  'lightly-row',
  'amazing-grace',
  'brahms-lullaby',
];

const sounding = (note: ScoreNote, beat: number) =>
  note.start <= beat + 1e-9 && beat < note.start + note.duration - 1e-9;

/** How long a note sounds between `from` and `to`. */
const within = (note: ScoreNote, from: number, to: number) =>
  Math.max(0, Math.min(note.start + note.duration, to) - Math.max(note.start, from));

const end = (score: Score) => {
  const last = score.measures.at(-1)!;
  return last.start + last.length;
};

describe.each(ANALYZED)('%s’s harmony', (id) => {
  const load = async () => {
    const score = await loadSong(id);
    expect(score.analysis, 'written in the song’s file').toBeDefined();
    return { score, analysis: score.analysis! };
  };

  it('has a chord that the left hand plays, and most of the melody sings, wherever one starts', async () => {
    const { score, analysis } = await load();
    const keyFifths = score.keyFifths ?? 0;
    analysis.chords.forEach((chord, i) => {
      const to = analysis.chords[i + 1]?.start ?? end(score);
      const tones = new Set(chordIn(keyFifths, chord.numeral).notes.map((n) => pitchClass(n.midi)));
      const where = `${chord.numeral} at beat ${chord.start}`;
      for (const note of score.notes.filter(
        (n) => n.hand === Hand.Left && sounding(n, chord.start),
      )) {
        expect(tones.has(pitchClass(note.pitch.midi)), `${where}: ${formatNote(note.pitch)}`).toBe(
          true,
        );
      }
      const melody = score.notes.filter((n) => n.hand === Hand.Right);
      const time = melody.reduce((sum, n) => sum + within(n, chord.start, to), 0);
      const inChord = melody
        .filter((n) => tones.has(pitchClass(n.pitch.midi)))
        .reduce((sum, n) => sum + within(n, chord.start, to), 0);
      if (time > 0) expect(inChord / time, `${where}: the melody`).toBeGreaterThanOrEqual(0.5);
    });
  });

  it('ends each phrase as its cadence says', async () => {
    const { score, analysis } = await load();
    for (const { measure, kind } of analysis.cadences) {
      const { start, length } = score.measures[measure]!;
      const last = chordAt(analysis, start + length - 1e-6)!;
      const before = chordBefore(analysis, last)?.numeral;
      const dominant = [Numeral.Five, Numeral.FiveSeven] as const;
      const where = `bar ${measure + 1}`;
      if (kind === Cadence.Half) expect(dominant, where).toContain(last.numeral);
      if (kind === Cadence.Authentic) {
        expect(last.numeral, where).toBe(Numeral.One);
        expect(dominant, where).toContain(before);
      }
      if (kind === Cadence.Plagal) {
        expect(last.numeral, where).toBe(Numeral.One);
        expect(before, where).toBe(Numeral.Four);
      }
    }
  });
});

describe('a song’s harmony', () => {
  it('names its chords from the key, so they move with it and the numerals stay', async () => {
    const song = await loadSong('ode-to-joy');
    const moved = transposeScore(song, 2);
    expect(moved.analysis).toEqual(song.analysis);
    const root = (score: Score) =>
      formatNote(chordIn(score.keyFifths ?? 0, Numeral.Five).notes[0]!);
    expect(root(song)).toBe('G4');
    expect(root(moved)).toBe('A4');
  });

  it('spells the chords of a key with flats', () => {
    const { notes, quality } = chordIn(-1, Numeral.Four);
    expect(notes.map(formatNote)).toEqual(['Bb4', 'D5', 'F5']);
    expect(quality).toBe('major');
    expect(chordIn(0, Numeral.FiveSeven).quality).toBe('dominant7');
  });

  const score = (analysis: object, extra: object = {}) =>
    parseInlineScore(
      {
        tempo: 100,
        timeSignature: [4, 4],
        notes: [
          { note: 'C4', start: 0, duration: 4, hand: 'R' },
          { note: 'G4', start: 4, duration: 4, hand: 'R' },
        ],
        analysis,
        ...extra,
      },
      'test',
    ).analysis as SongAnalysis;
  const written = {
    key: 'C',
    chords: ['I', 'V - I -'],
    cadences: [{ bar: 2, kind: 'authentic' }],
    sections: [{ bar: 1, name: 'A' }],
  };

  it('reads a chord a bar, or one a beat with holds, keeping each change', () => {
    expect(score(written).chords).toEqual([
      { start: 0, numeral: 'I' },
      { start: 4, numeral: 'V' },
      { start: 6, numeral: 'I' },
    ]);
    expect(score({ ...written, chords: ['I', 'I'] }).chords).toEqual([{ start: 0, numeral: 'I' }]);
    expect(score({ ...written, chords: ['', 'V'] }).chords).toEqual([{ start: 4, numeral: 'V' }]);
  });

  it('counts its bars from 1', () => {
    const analysis = score(written);
    expect(analysis.cadences).toEqual([{ measure: 1, kind: 'authentic' }]);
    expect(analysis.sections).toEqual([{ measure: 0, name: 'A' }]);
  });

  it('refuses what it couldn’t show', () => {
    const bad =
      (changes: object, extra: object = {}) =>
      () =>
        score({ ...written, ...changes }, extra);
    expect(bad({ key: 'G' })).toThrow('isn’t the key of the signature');
    expect(bad({ key: 'Am' })).toThrow('only major keys');
    expect(bad({ key: 'H' })).toThrow('expected a key');
    expect(bad({ chords: ['I'] })).toThrow('each of the 2 bars');
    expect(bad({ chords: ['I', 'V I'] })).toThrow('each of its 4 beats');
    expect(bad({ chords: ['I', 'X'] })).toThrow('isn’t a numeral');
    expect(bad({ cadences: [{ bar: 3, kind: 'half' }] })).toThrow('from 1 to 2');
    expect(bad({ cadences: [{ bar: 2, kind: 'deceptive' }] })).toThrow('kind');
    expect(bad({ sections: [{ bar: 2, name: 'A' }] })).toThrow('starting at bar 1');
    expect(
      bad({
        sections: [
          { bar: 1, name: 'A' },
          { bar: 1, name: 'B' },
        ],
      }),
    ).toThrow('in order');
    expect(bad({ sections: [{ bar: 1, name: 'Verse' }] })).toThrow('short name');
    expect(bad({}, { repeats: [{ from: 0, to: 8 }] })).toThrow('repeats');
  });
});
