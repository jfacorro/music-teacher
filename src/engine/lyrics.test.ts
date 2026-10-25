import { describe, expect, it } from 'vitest';
import { parseInlineScore, ScoreError } from '../content/loaders/inlineScore';
import { lyricLines, moveAccompaniment, parseLyrics, songParts, syllableText } from './lyrics';
import { Hand, Syllabic } from './score';
import { scoreOf } from './testUtils';

const melody = scoreOf([
  ['C4', 0],
  ['C4', 1],
  ['G4', 2],
  ['G4', 3],
  ['A4', 4],
  ['A4', 5],
  ['G4', 6, 2],
]).notes;

describe('parseLyrics', () => {
  it('puts a syllable on each note, a hyphen going on to the next', () => {
    const lyrics = parseLyrics('Twin-kle, twin-kle, | lit-tle star,', melody, [4, 4]);
    expect(lyrics.map((lyric) => lyric && syllableText(lyric))).toEqual([
      'Twin-',
      'kle,',
      'twin-',
      'kle,',
      'lit-',
      'tle',
      'star,',
    ]);
    expect(lyrics.map((lyric) => lyric?.syllabic)).toEqual([
      Syllabic.Begin,
      Syllabic.End,
      Syllabic.Begin,
      Syllabic.End,
      Syllabic.Begin,
      Syllabic.End,
      Syllabic.Single,
    ]);
  });

  it('holds a syllable over the next note, and joins words sung on one note', () => {
    const lyrics = parseLyrics('A-ma-zing _ grace, que~a mí', melody, [4, 4]);
    expect(lyrics[2]).toEqual({ text: 'zing', syllabic: Syllabic.End, extend: true });
    expect(lyrics[3]).toBeNull();
    expect(lyrics[5]).toEqual({ text: 'que‿a', syllabic: Syllabic.Single });
    // A hold within a word.
    const within = parseLyrics('per-di-do-_-ta-ba y', melody, [4, 4]);
    expect(within[3]).toBeNull();
    expect(within[4]).toEqual({ text: 'ta', syllabic: Syllabic.Middle });
  });

  it('checks the words against the notes and the bars', () => {
    expect(() => parseLyrics('one two', melody, [4, 4])).toThrow('2 syllables for 7 notes');
    expect(() => parseLyrics('a b c d e f g h', melody, [4, 4])).toThrow('more syllables');
    expect(() => parseLyrics('a b | c d e f g', melody, [4, 4])).toThrow('"c" should start bar 1');
    expect(() => parseLyrics('_ a b c d e f', melody, [4, 4])).toThrow('held syllable');
  });
});

describe('lyricLines', () => {
  it('gives the words as read, in lines, keeping hyphens written with a backslash', () => {
    expect(
      lyricLines('Prê-te\\-moi ta | plu-me / pour é-cri-re~un | mot, A-ma-zing _ grace'),
    ).toEqual(['Prête-moi ta plume', 'pour écrire un mot, Amazing grace']);
  });
});

describe('songs with words', () => {
  const song = () =>
    parseInlineScore(
      {
        tempo: 90,
        timeSignature: [4, 4],
        lyricsHand: 'L',
        lyrics: { en: 'Hot cross buns!', es: '¡Pan con miel!' },
        notes: [
          { note: 'E3', start: 0, duration: 1, hand: 'L' },
          { note: 'D3', start: 1, duration: 1, hand: 'L' },
          { note: 'C3', start: 2, duration: 2, hand: 'L' },
          { note: 'C4', start: 0, duration: 4, hand: 'R' },
        ],
      },
      'song',
    );

  it('keeps the syllables on the notes sung, in every language', () => {
    const score = song();
    expect(score.lyrics).toEqual({
      hand: Hand.Left,
      lines: { en: ['Hot cross buns!'], es: ['¡Pan con miel!'] },
    });
    const parts = songParts(score)!;
    expect(parts.melody.notes.map((note) => note.lyrics?.es?.text)).toEqual([
      '¡Pan',
      'con',
      'miel!',
    ]);
    expect(parts.accompaniment.map((note) => note.pitch.midi)).toEqual([60]);
  });

  it('reports words that don’t fit, with where they are', () => {
    expect(() =>
      parseInlineScore(
        {
          tempo: 90,
          timeSignature: [4, 4],
          lyrics: { en: 'Twin-kle' },
          notes: [{ note: 'C4', start: 0, duration: 1, hand: 'R' }],
        },
        'song "x"',
      ),
    ).toThrow(new ScoreError('song "x" › lyrics › en', 'more syllables than notes (1), at "kle"'));
  });

  it('moves the accompaniment with the melody, by whole octaves only as far as needed', () => {
    const score = song();
    const { accompaniment } = songParts(score)!;
    const midi = (semitones: number) =>
      moveAccompaniment(score, accompaniment, semitones).map((note) => note.pitch.midi);
    expect(midi(12)).toEqual([60]);
    expect(midi(-10)).toEqual([62]);
    expect(midi(5)).toEqual([65]);
  });
});
