import { describe, expect, it } from 'vitest';
import { scoreOf } from '../engine/testUtils';
import { loadSong, SONG_IDS } from './songs';
import { DIVISIONS, noteCardXml, noteKey, scoreToMusicXml } from './musicxml';
import { parseNote } from '../theory/pitch';

/** The <note> elements of a staff, as short strings: "C4:quarter", "rest:half", "D4:eighth.". */
function written(xml: string, staff: number): string[] {
  return [...xml.matchAll(/<note>(.*?)<\/note>/g)]
    .map((match) => match[1]!)
    .filter((note) => note.includes(`<staff>${staff}</staff>`))
    .map((note) => {
      const type = /<type>(\w+)<\/type>/.exec(note)?.[1] ?? 'measure';
      const dots = '.'.repeat((note.match(/<dot\/>/g) ?? []).length);
      const tie = note.includes('<tie type="start"/>') ? '~' : '';
      if (note.includes('<rest')) return `rest:${type}${dots}`;
      const [, step, alter, octave] =
        /<step>(\w)<\/step>(?:<alter>(-?\d)<\/alter>)?<octave>(\d)/.exec(note)!;
      const accidental = alter === '1' ? '#' : alter === '-1' ? 'b' : '';
      const chord = note.includes('<chord/>') ? '+' : '';
      return `${chord}${step}${accidental}${octave}:${type}${dots}${tie}`;
    });
}

const measures = (xml: string) => (xml.match(/<measure /g) ?? []).length;

describe('scoreToMusicXml', () => {
  it('writes a one-hand melody on a treble staff', () => {
    const { xml, staves } = scoreToMusicXml(
      scoreOf([
        ['C4', 0],
        ['D4', 1],
        ['E4', 2, 2],
      ]),
    );
    expect(staves).toEqual([{ hand: 'R', number: 1 }]);
    expect(xml).toContain('<sign>G</sign>');
    expect(xml).not.toContain('<sign>F</sign>');
    expect(xml).toContain(`<divisions>${DIVISIONS}</divisions>`);
    expect(written(xml, 1)).toEqual(['C4:quarter', 'D4:quarter', 'E4:half']);
  });

  it('puts the left hand on a bass staff', () => {
    const { xml, staves } = scoreToMusicXml(
      scoreOf([
        ['E4', 0, 4],
        ['C3', 0, 4, 'L'],
      ]),
    );
    expect(staves).toEqual([
      { hand: 'R', number: 1 },
      { hand: 'L', number: 2 },
    ]);
    expect(xml).toContain('<clef number="2"><sign>F</sign>');
    expect(xml).toContain(`<backup><duration>${4 * DIVISIONS}</duration></backup>`);
    expect(written(xml, 1)).toEqual(['E4:whole']);
    expect(written(xml, 2)).toEqual(['C3:whole']);
  });

  it('fills gaps with rests and writes empty bars as whole-bar rests', () => {
    const { xml } = scoreToMusicXml(
      scoreOf([
        ['C4', 1],
        ['D4', 3],
        ['E4', 8, 4],
      ]),
    );
    expect(measures(xml)).toBe(3);
    expect(written(xml, 1)).toEqual([
      'rest:quarter',
      'C4:quarter',
      'rest:quarter',
      'D4:quarter',
      'rest:measure',
      'E4:whole',
    ]);
  });

  it('writes dotted notes, eighths and sixteenths', () => {
    const { xml } = scoreToMusicXml(
      scoreOf([
        ['E4', 0, 1.5],
        ['D4', 1.5, 0.5],
        ['C4', 2, 0.25],
        ['D4', 2.25, 0.25],
        ['E4', 2.5, 0.5],
        ['F4', 3, 1],
      ]),
    );
    expect(written(xml, 1)).toEqual([
      'E4:quarter.',
      'D4:eighth',
      'C4:16th',
      'D4:16th',
      'E4:eighth',
      'F4:quarter',
    ]);
  });

  it('ties notes across bar lines and lengths without a single note value', () => {
    const { xml } = scoreToMusicXml(
      scoreOf([
        ['C4', 3, 2],
        ['G4', 5, 2.5], // 2½ beats: half tied to eighth
      ]),
    );
    expect(written(xml, 1)).toEqual([
      'rest:half.',
      'C4:quarter~',
      'C4:quarter',
      'G4:half~',
      'G4:eighth',
      'rest:eighth',
    ]);
    expect(xml).toContain('<tied type="stop"/>');
  });

  it('writes chords and accidentals with their spelling', () => {
    const { xml } = scoreToMusicXml(
      scoreOf([
        ['C4', 0, 4],
        ['Eb4', 0, 4],
        ['G4', 0, 4],
      ]),
    );
    expect(written(xml, 1)).toEqual(['C4:whole', '+Eb4:whole', '+G4:whole']);
  });

  it('writes finger numbers once per note, not on tied continuations', () => {
    const score = scoreOf([['C4', 3, 2]]); // tied across the bar line
    const fingered = { ...score, notes: score.notes.map((n) => ({ ...n, finger: 1 as const })) };
    const { xml } = scoreToMusicXml(fingered);
    expect((xml.match(/<fingering>1<\/fingering>/g) ?? []).length).toBe(1);
  });

  it('can leave out a hand’s staff', () => {
    const score = scoreOf([
      ['E4', 0, 4],
      ['C3', 0, 4, 'L'],
    ]);
    const right = scoreToMusicXml(score, { hands: ['R'] });
    expect(right.staves).toEqual([{ hand: 'R', number: 1 }]);
    expect(right.xml).not.toContain('<sign>F</sign>');
    expect(written(right.xml, 1)).toEqual(['E4:whole']);

    const left = scoreToMusicXml(score, { hands: ['L'] });
    expect(left.staves).toEqual([{ hand: 'L', number: 1 }]);
    expect(left.xml).toContain('<clef number="1"><sign>F</sign>');
    expect(written(left.xml, 1)).toEqual(['C3:whole']);
  });

  it('writes labels under notes, once per tied note, stacked for chords', () => {
    const { xml } = scoreToMusicXml(
      scoreOf([
        ['C4', 3, 2], // tied across the bar line
        ['E4', 5, 1],
        ['G4', 5, 1],
      ]),
      { noteLabel: (note) => `<${note.pitch.step}>` },
    );
    const lyric = /<lyric number="(\d)">.*?<text>(.*?)<\/text><\/lyric>/g;
    const lyrics = [...xml.matchAll(lyric)].map((m) => `${m[1]}:${m[2]}`);
    expect(lyrics).toEqual(['1:&lt;C&gt;', '1:&lt;E&gt;', '2:&lt;G&gt;']);
  });

  it('can draw a staff for a hand without notes, and pictures without rests or bar lines', () => {
    const score = scoreOf([['G4', 0, 4]]);
    const both = scoreToMusicXml(score, { hands: ['R', 'L'] });
    expect(both.staves).toEqual([
      { hand: 'R', number: 1 },
      { hand: 'L', number: 2 },
    ]);
    expect(written(both.xml, 2)).toEqual(['rest:measure']);
    expect(both.xml).not.toContain('print-object="no"');

    const picture = scoreToMusicXml(score, { hands: ['R', 'L'], illustration: true });
    expect(picture.xml).toContain('<note print-object="no"><rest measure="yes"/>');
    expect(picture.xml).toContain('<bar-style>none</bar-style>');
    expect(written(picture.xml.replaceAll(' print-object="no"', ''), 1)).toEqual(['G4:whole']);
  });

  it('writes rhythm on a one-line percussion staff', () => {
    const { xml } = scoreToMusicXml(
      scoreOf([
        ['B4', 0],
        ['B4', 1, 3],
      ]),
      { rhythm: true },
    );
    expect(xml).toContain('<sign>percussion</sign>');
    expect(xml).toContain('<staff-lines>1</staff-lines>');
    expect(xml).not.toContain('<pitch>');
    expect(xml.split('<stem>up</stem>')).toHaveLength(3); // both notes
    expect(xml).toContain(
      '<unpitched><display-step>B</display-step><display-octave>4</display-octave></unpitched>',
    );
    expect(
      written(
        xml.replaceAll(/<unpitched>.*?<\/unpitched>/g, '<step>B</step><octave>4</octave>'),
        1,
      ),
    ).toEqual(['B4:quarter', 'B4:half.']);
  });

  it('writes a quiz card: one whole note on the chosen clef, with its accidental', () => {
    const treble = noteCardXml(parseNote('F#4'), 'treble');
    expect(treble).toContain('<sign>G</sign>');
    expect(treble).toContain('<step>F</step><alter>1</alter><octave>4</octave>');
    expect(treble).toContain('<accidental>sharp</accidental>');
    expect(treble).toContain('<time print-object="no">');
    const bass = noteCardXml(parseNote('C3'), 'bass');
    expect(bass).toContain('<sign>F</sign>');
    expect(bass).not.toContain('<accidental>');
  });

  it('indexes every written note back to its score note', () => {
    const score = scoreOf([
      ['C4', 3, 2],
      ['C3', 0, 4, 'L'],
    ]);
    const { notes } = scoreToMusicXml(score);
    const c4 = score.notes.find((n) => n.pitch.midi === 60)!;
    expect(notes.get(noteKey(1, 3 * DIVISIONS, 60))).toBe(c4);
    expect(notes.get(noteKey(1, 4 * DIVISIONS, 60))).toBe(c4); // the tied part in bar 2
    expect(notes.get(noteKey(2, 0, 48))?.hand).toBe('L');
  });

  it.each(SONG_IDS)('converts the song %s, filling every bar exactly', async (id) => {
    const score = await loadSong(id);
    const { xml, staves } = scoreToMusicXml(score);
    const bar = 4 * DIVISIONS;
    for (const measure of xml.match(/<measure .*?<\/measure>/g)!) {
      for (const { number } of staves) {
        const durations = [...measure.matchAll(/<note>(.*?)<\/note>/g)]
          .map((m) => m[1]!)
          .filter((n) => n.includes(`<staff>${number}</staff>`) && !n.includes('<chord/>'))
          .map((n) => Number(/<duration>(\d+)<\/duration>/.exec(n)![1]));
        expect(durations.reduce((a, b) => a + b, 0)).toBe(bar);
      }
    }
  });
});
