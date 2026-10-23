import { describe, expect, it } from 'vitest';
import { scoreOf } from '../engine/testUtils';
import { loadSong, SONG_IDS } from './songs';
import { DIVISIONS, noteCardXml, noteKey, scoreToMusicXml, Clef } from './musicxml';
import { pitchOf } from '../theory/pitch';
import { Articulation, beatsPerMeasure, Hand } from '../engine/score';

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
  it('writes staccato dots, accents and slurs from the first note to the last', () => {
    const base = scoreOf([
      ['C4', 0],
      ['D4', 1],
      ['E4', 2],
      ['F4', 3],
    ]);
    const { xml } = scoreToMusicXml({
      ...base,
      notes: base.notes.map((note, i) =>
        i === 3 ? { ...note, articulations: [Articulation.Staccato, Articulation.Accent] } : note,
      ),
      slurs: [{ start: 0, end: 2, hand: Hand.Right }],
    });
    const notes = [...xml.matchAll(/<note>(.*?)<\/note>/g)].map((match) => match[1]!);
    expect(notes[0]).toContain('<slur type="start" number="1"/>');
    expect(notes[1]).not.toContain('<slur');
    expect(notes[2]).toContain('<slur type="stop" number="1"/>');
    expect(notes[3]).toContain('<articulations><staccato/><accent/></articulations>');
  });

  it('writes pedal marks under the bottom staff: start, change and stop', () => {
    const base = scoreOf([
      ['C4', 0],
      ['D4', 1],
      ['E4', 2],
      ['F4', 3],
      ['C3', 0, 4, Hand.Left],
    ]);
    const { xml } = scoreToMusicXml({
      ...base,
      pedal: [
        { down: 0, up: 2 },
        { down: 2, up: 3 },
      ],
    });
    const pedals = [...xml.matchAll(/<direction[^>]*>(?:(?!<\/direction>).)*<\/direction>/g)]
      .map((match) => match[0])
      .filter((direction) => direction.includes('<pedal'))
      .map((direction) => [
        /<pedal type="(\w+)"/.exec(direction)![1],
        /<staff>(\d)<\/staff>/.exec(direction)![1],
      ]);
    expect(pedals).toEqual([
      ['start', '2'],
      ['change', '2'],
      ['stop', '2'],
    ]);
  });

  it('writes a crossing hand’s notes on the other staff, labeled once per crossing', () => {
    const base = scoreOf([
      ['C3', 0, 1, Hand.Left],
      ['C4', 1, 1, Hand.Right],
      ['C5', 2, 1, Hand.Left],
      ['E5', 3, 1, Hand.Left],
    ]);
    const score = {
      ...base,
      notes: base.notes.map((note) => (note.pitch.midi >= 72 ? { ...note, crossed: true } : note)),
    };
    const notes = (xml: string, staff: number) =>
      written(xml, staff).filter((note) => !note.startsWith('rest'));
    const { xml, notes: index } = scoreToMusicXml(score, {
      handLabel: (hand) => (hand === Hand.Left ? 'L.H.' : 'R.H.'),
    });
    expect(notes(xml, 1)).toEqual(['C4:quarter', 'C5:quarter', 'E5:quarter']);
    expect(notes(xml, 2)).toEqual(['C3:quarter']);
    expect(xml.match(/<words>L\.H\.<\/words>/g)).toHaveLength(1);
    expect(index.get(noteKey(1, 2 * DIVISIONS, 72))?.hand).toBe(Hand.Left);
    // The left hand alone keeps all its notes on its own staff.
    const alone = scoreToMusicXml(score, { hands: [Hand.Left] }).xml;
    expect(notes(alone, 1)).toEqual(['C3:quarter', 'C5:quarter', 'E5:quarter']);
    expect(alone).not.toContain('<words>');
  });

  it('writes repeat signs, first and second endings, fermatas and rit.', () => {
    const base = scoreOf([
      ['C4', 0, 4],
      ['D4', 4, 4],
      ['E4', 8, 4],
      ['F4', 12, 4],
      ['G4', 16, 4],
    ]);
    const { xml } = scoreToMusicXml({
      ...base,
      notes: base.notes.map((note, i) => (i === 4 ? { ...note, fermata: true } : note)),
      repeats: [
        {
          start: 4,
          end: 12,
          endings: [
            { start: 8, end: 12 },
            { start: 12, end: 16 },
          ],
        },
      ],
      ritardandos: [{ start: 16, end: 20 }],
    });
    const bar = (number: number) =>
      new RegExp(`<measure number="${number}">(.*?)</measure>`).exec(xml)![1]!;
    expect(bar(1)).not.toContain('<barline');
    expect(bar(2)).toMatch(
      /^<barline location="left"><bar-style>heavy-light<\/bar-style><repeat direction="forward"\/><\/barline>/,
    );
    expect(bar(3)).toContain('<ending number="1" type="start"/>');
    expect(bar(3)).toMatch(
      /<ending number="1" type="stop"\/><repeat direction="backward"\/><\/barline>$/,
    );
    expect(bar(4)).toContain('<ending number="2" type="start"/>');
    expect(bar(4)).toContain('<ending number="2" type="discontinue"/>');
    expect(bar(5)).toContain('<fermata type="upright"/>');
    expect(bar(5)).toContain('<words font-style="italic">rit.</words>');
    expect(xml).not.toContain('a tempo');
  });

  it('beams 6/8 in groups of three eighths, sixteenths with a second beam', () => {
    const score = scoreOf(
      [
        ['C4', 0, 0.5],
        ['D4', 0.5, 0.5],
        ['E4', 1, 0.5],
        ['F4', 1.5, 0.25],
        ['G4', 1.75, 0.25],
        ['F4', 2, 0.5],
        ['E4', 2.5, 0.5],
      ],
      60,
      [6, 8],
    );
    const beams = [...scoreToMusicXml(score).xml.matchAll(/<note>(.*?)<\/note>/g)].map((match) =>
      [...match[1]!.matchAll(/<beam number="(\d)">([\w ]+)<\/beam>/g)]
        .map(([, number, kind]) => `${number}:${kind}`)
        .join(' '),
    );
    expect(beams).toEqual([
      '1:begin',
      '1:continue',
      '1:end',
      '1:begin 2:begin',
      '1:continue 2:end',
      '1:continue',
      '1:end',
    ]);
    // Simple time is left to OSMD's automatic beams.
    expect(
      scoreToMusicXml(
        scoreOf([
          ['C4', 0, 0.5],
          ['D4', 0.5, 0.5],
        ]),
      ).xml,
    ).not.toContain('<beam');
  });

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
        ['C3', 0, 4, Hand.Left],
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
      ['C3', 0, 4, Hand.Left],
    ]);
    const right = scoreToMusicXml(score, { hands: [Hand.Right] });
    expect(right.staves).toEqual([{ hand: 'R', number: 1 }]);
    expect(right.xml).not.toContain('<sign>F</sign>');
    expect(written(right.xml, 1)).toEqual(['E4:whole']);

    const left = scoreToMusicXml(score, { hands: [Hand.Left] });
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
    const both = scoreToMusicXml(score, { hands: [Hand.Right, Hand.Left] });
    expect(both.staves).toEqual([
      { hand: 'R', number: 1 },
      { hand: 'L', number: 2 },
    ]);
    expect(written(both.xml, 2)).toEqual(['rest:measure']);
    expect(both.xml).not.toContain('print-object="no"');

    const picture = scoreToMusicXml(score, { hands: [Hand.Right, Hand.Left], illustration: true });
    expect(picture.xml).toContain('<note print-object="no"><rest measure="yes"/>');
    expect(picture.xml).toContain('<bar-style>none</bar-style>');
    expect(written(picture.xml.replaceAll(' print-object="no"', ''), 1)).toEqual(['G4:whole']);
  });

  it('writes dynamics and hairpins under the top staff, where they fall', () => {
    const score = scoreOf([
      ['C4', 0, 4],
      ['D4', 4, 2],
      ['E4', 6, 2],
      ['F4', 8, 4],
    ]);
    score.dynamics = {
      marks: [
        { beat: 0, dynamic: 'p' },
        { beat: 8, dynamic: 'f' },
      ],
      hairpins: [{ start: 4, end: 8, kind: 'crescendo' }],
    };
    const { xml } = scoreToMusicXml(score);
    /** What each bar writes, in order: a dynamic, a wedge, or a note. */
    const bars = [...xml.matchAll(/<measure .*?<\/measure>/g)].map((bar) =>
      [...bar[0].matchAll(/<dynamics><(\w+)\/>|<wedge type="(\w+)"\/>|<step>(\w)<\/step>/g)].map(
        ([, dynamic, wedge, step]) => dynamic ?? (wedge ? `wedge:${wedge}` : step),
      ),
    );
    expect(bars).toEqual([
      ['p', 'C'],
      ['wedge:crescendo', 'D', 'E'],
      ['wedge:stop', 'f', 'F'],
    ]);
    expect(xml).toContain('<direction placement="below">');
  });

  it('places a dynamic inside a rest by splitting the rest', () => {
    const score = scoreOf([['C4', 0, 1]]);
    score.dynamics = { marks: [{ beat: 2, dynamic: 'mf' }], hairpins: [] };
    const { xml } = scoreToMusicXml(score);
    expect(written(xml, 1)).toEqual(['C4:quarter', 'rest:quarter', 'rest:half']);
    expect(xml.indexOf('<mf/>')).toBeGreaterThan(xml.lastIndexOf('<type>quarter</type>'));
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
    const treble = noteCardXml(pitchOf('F#4'), Clef.Treble);
    expect(treble).toContain('<sign>G</sign>');
    expect(treble).toContain('<step>F</step><alter>1</alter><octave>4</octave>');
    expect(treble).toContain('<accidental>sharp</accidental>');
    expect(treble).toContain('<time print-object="no">');
    const bass = noteCardXml(pitchOf('C3'), Clef.Bass);
    expect(bass).toContain('<sign>F</sign>');
    expect(bass).not.toContain('<accidental>');
  });

  it('indexes every written note back to its score note', () => {
    const score = scoreOf([
      ['C4', 3, 2],
      ['C3', 0, 4, Hand.Left],
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
    const bar = beatsPerMeasure(score.timeSignature) * DIVISIONS;
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
