// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatNote, type NoteString, pitchOf } from '../../theory/pitch';
import { type ImportedNote, ImportErrorCode, ImportFormat, ImportWarning } from './importedMusic';
import { parseMusicXml } from './musicXmlFile';

/** A pitched note lasting `duration` divisions. */
function n(name: NoteString, duration: number, extra = ''): string {
  const { step, alter, octave } = pitchOf(name);
  return (
    `<note><pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}` +
    `<octave>${octave}</octave></pitch><duration>${duration}</duration>${extra}</note>`
  );
}
const rest = (duration: number, extra = '') =>
  `<note><rest/><duration>${duration}</duration>${extra}</note>`;
const backup = (duration: number) => `<backup><duration>${duration}</duration></backup>`;
const attributes = (inner: string) => `<attributes>${inner}</attributes>`;
const measure = (...content: string[]) => `<measure>${content.join('')}</measure>`;

interface PartSpec {
  name?: string;
  measures: string[];
}

function scoreXml(parts: PartSpec[], header = ''): string {
  const list = parts
    .map(
      (part, i) =>
        `<score-part id="P${i + 1}"><part-name>${part.name ?? ''}</part-name></score-part>`,
    )
    .join('');
  const body = parts
    .map((part, i) => `<part id="P${i + 1}">${part.measures.join('')}</part>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0">${header}<part-list>${list}</part-list>${body}</score-partwise>`;
}

const piece = (...measures: string[]) => scoreXml([{ name: 'Melody', measures }]);
const written = (notes: ImportedNote[]) =>
  notes.map((note) => [formatNote(note.pitch), note.start, note.duration]);

describe('parseMusicXml', () => {
  it('reads a piano part as one track per staff, with title, composer, tempo and key', () => {
    const music = parseMusicXml(
      scoreXml(
        [
          {
            name: 'Piano',
            measures: [
              measure(
                attributes(
                  '<divisions>1</divisions><key><fifths>1</fifths></key>' +
                    '<time><beats>4</beats><beat-type>4</beat-type></time><staves>2</staves>',
                ),
                '<direction><direction-type><words>Allegro</words></direction-type><sound tempo="132"/></direction>',
                n('B4', 1, '<staff>1</staff>'),
                n('C5', 1, '<staff>1</staff>'),
                n('D5', 1, '<staff>1</staff>'),
                n('F#5', 1, '<staff>1</staff>'),
                backup(4),
                n('G2', 4, '<staff>2</staff>'),
              ),
            ],
          },
        ],
        '<work><work-title>Little Piece</work-title></work>' +
          '<identification><creator type="composer">A. Composer</creator></identification>',
      ),
    );
    expect(music.format).toBe(ImportFormat.MusicXml);
    expect(music.title).toBe('Little Piece');
    expect(music.composer).toBe('A. Composer');
    expect(music.tempo).toBe(132);
    expect(music.keyFifths).toBe(1);
    expect(music.timeSignature).toEqual([4, 4]);
    expect(music.tracks.map((track) => [track.name, track.staff])).toEqual([
      ['Piano', 1],
      ['Piano', 2],
    ]);
    expect(written(music.tracks[0]!.notes)).toEqual([
      ['B4', 0, 1],
      ['C5', 1, 1],
      ['D5', 2, 1],
      ['F#5', 3, 1],
    ]);
    expect(written(music.tracks[1]!.notes)).toEqual([['G2', 0, 4]]);
    expect(music.warnings).toEqual([]);
  });

  it('keeps the written spelling, chords and fingering', () => {
    const music = parseMusicXml(
      piece(
        measure(
          attributes('<divisions>2</divisions>'),
          n('C4', 4, '<notations><technical><fingering>1</fingering></technical></notations>'),
          n('E4', 4, '<chord/>'),
          n('G4', 4, '<chord/>'),
          n('Bb4', 2),
          n('A#4', 2),
        ),
      ),
    );
    expect(written(music.tracks[0]!.notes)).toEqual([
      ['C4', 0, 2],
      ['E4', 0, 2],
      ['G4', 0, 2],
      ['Bb4', 2, 1],
      ['A#4', 3, 1],
    ]);
    expect(music.tracks[0]!.notes[0]!.finger).toBe(1);
    expect(music.tracks[0]!.staff).toBeNull();
  });

  it('reads articulations and where slurs start and stop', () => {
    const notations = (inner: string) => `<notations>${inner}</notations>`;
    const music = parseMusicXml(
      piece(
        measure(
          attributes('<divisions>1</divisions>'),
          n('C4', 1, notations('<slur type="start" number="1"/>')),
          n('D4', 1, notations('<articulations><staccatissimo/><strong-accent/></articulations>')),
          n(
            'E4',
            2,
            notations('<slur type="stop" number="1"/><articulations><tenuto/></articulations>'),
          ),
        ),
      ),
    );
    const [c, d, e] = music.tracks[0]!.notes;
    expect(c?.slurs).toEqual(['start']);
    expect(d?.articulations).toEqual(['staccato', 'accent']);
    expect(e).toMatchObject({ slurs: ['stop'], articulations: ['tenuto'] });
  });

  it('reads pedal marks: down at a start, up at a stop, both at a change', () => {
    const pedal = (type: string, offset = 0) =>
      `<direction placement="below"><direction-type><pedal type="${type}" line="yes"/>` +
      `</direction-type>${offset ? `<offset>${offset}</offset>` : ''}</direction>`;
    const music = parseMusicXml(
      piece(
        measure(
          attributes('<divisions>1</divisions>'),
          pedal('start'),
          n('C4', 2),
          pedal('change'),
          n('E4', 2),
        ),
        measure(n('G4', 2), pedal('stop'), rest(2)),
      ),
    );
    expect(music.pedal).toEqual([
      { down: 0, up: 2 },
      { down: 2, up: 6 },
    ]);
    expect(parseMusicXml(piece(measure(n('C4', 4))))).not.toHaveProperty('pedal');
  });

  it('joins tied notes, also across bar lines', () => {
    const music = parseMusicXml(
      piece(
        measure(attributes('<divisions>1</divisions>'), rest(2), n('D4', 2, '<tie type="start"/>')),
        measure(n('D4', 4, '<tie type="stop"/><tie type="start"/>')),
        measure(n('D4', 1, '<tie type="stop"/>'), n('D4', 3)),
      ),
    );
    expect(written(music.tracks[0]!.notes)).toEqual([
      ['D4', 2, 7],
      ['D4', 9, 3],
    ]);
  });

  it('pads a pickup bar to a whole bar', () => {
    const music = parseMusicXml(
      piece(
        `<measure number="0" implicit="yes">${attributes(
          '<divisions>1</divisions><time><beats>3</beats><beat-type>4</beat-type></time>',
        )}${n('G4', 1)}</measure>`,
        measure(n('C5', 3)),
      ),
    );
    expect(written(music.tracks[0]!.notes)).toEqual([
      ['G4', 2, 1],
      ['C5', 3, 3],
    ]);
  });

  it('leaves out grace notes, cue notes and unpitched notes, keeping the time', () => {
    const music = parseMusicXml(
      piece(
        measure(
          attributes('<divisions>1</divisions>'),
          '<note><grace/><pitch><step>B</step><octave>4</octave></pitch></note>',
          n('C5', 1),
          n('D5', 1, '<cue/>'),
          '<note><unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched><duration>1</duration></note>',
          n('E5', 1),
        ),
      ),
    );
    expect(written(music.tracks[0]!.notes)).toEqual([
      ['C5', 0, 1],
      ['E5', 3, 1],
    ]);
  });

  it('follows changes of divisions', () => {
    const music = parseMusicXml(
      piece(
        measure(attributes('<divisions>1</divisions>'), n('C4', 4)),
        measure(attributes('<divisions>4</divisions>'), n('D4', 2), n('E4', 14)),
      ),
    );
    expect(written(music.tracks[0]!.notes)).toEqual([
      ['C4', 0, 4],
      ['D4', 4, 0.5],
      ['E4', 4.5, 3.5],
    ]);
  });

  it('reads parts on one staff as tracks named after their part', () => {
    const music = parseMusicXml(
      scoreXml([
        { name: 'Flute', measures: [measure(attributes('<divisions>1</divisions>'), n('C5', 4))] },
        { name: '', measures: [measure(attributes('<divisions>1</divisions>'), n('C3', 4))] },
      ]),
    );
    expect(music.tracks.map((track) => [track.name, track.staff])).toEqual([
      ['Flute', null],
      [null, null],
    ]);
  });

  it('takes the tempo from a metronome mark, or uses 100', () => {
    const metronome =
      '<direction><direction-type><metronome><beat-unit>half</beat-unit>' +
      '<per-minute>60</per-minute></metronome></direction-type></direction>';
    expect(
      parseMusicXml(piece(measure(attributes('<divisions>1</divisions>'), metronome, n('C4', 4))))
        .tempo,
    ).toBe(120);
    expect(parseMusicXml(piece(measure(n('C4', 4)))).tempo).toBe(100);
  });

  it('reads repeats with their endings, fermatas, and rit. up to a tempo', () => {
    const left = (inner: string) => `<barline location="left">${inner}</barline>`;
    const right = (inner: string) => `<barline location="right">${inner}</barline>`;
    const words = (text: string) =>
      `<direction><direction-type><words>${text}</words></direction-type></direction>`;
    const music = parseMusicXml(
      piece(
        measure(attributes('<divisions>1</divisions>'), n('C4', 4)),
        measure(left('<repeat direction="forward"/>'), n('D4', 4)),
        measure(
          left('<ending number="1" type="start"/>'),
          n('E4', 4),
          right('<ending number="1" type="stop"/><repeat direction="backward"/>'),
        ),
        measure(
          left('<ending number="2" type="start"/>'),
          words('rit.'),
          n('F4', 4, '<notations><fermata/></notations>'),
          right('<ending number="2" type="discontinue"/>'),
        ),
        measure(words('a tempo'), n('G4', 4)),
      ),
    );
    expect(music.repeats).toEqual([
      {
        start: 4,
        end: 12,
        endings: [
          { start: 8, end: 12 },
          { start: 12, end: 16 },
        ],
      },
    ]);
    expect(music.ritardandos).toEqual([{ start: 12, end: 16 }]);
    expect(music.tracks[0]!.notes[3]?.fermata).toBe(true);
    expect(music.warnings).toEqual([]);
  });

  it('plays da capo and the like once, as written', () => {
    const music = parseMusicXml(
      piece(
        measure(attributes('<divisions>1</divisions>'), n('C4', 4)),
        measure(
          n('D4', 4),
          '<direction><direction-type><words>D.C. al Fine</words></direction-type></direction>',
        ),
      ),
    );
    expect(music.warnings).toEqual([ImportWarning.RepeatsIgnored]);
    expect(music).not.toHaveProperty('repeats');
  });

  it('warns about rounded triplets, tempo and time changes, and repeats', () => {
    const music = parseMusicXml(
      piece(
        measure(
          attributes(
            '<divisions>3</divisions><time><beats>2</beats><beat-type>4</beat-type></time>',
          ),
          '<sound tempo="90"/>',
          n('C4', 1),
          n('D4', 1),
          n('E4', 1),
          n('F4', 3),
        ),
        measure(
          attributes('<time><beats>3</beats><beat-type>4</beat-type></time>'),
          '<sound tempo="70"/>',
          n('G4', 9),
          '<barline location="right"><repeat direction="backward"/></barline>',
        ),
      ),
    );
    expect(music.tempo).toBe(90);
    expect(music.timeSignature).toEqual([2, 4]);
    expect(music.warnings).toEqual([
      ImportWarning.TimingRounded,
      ImportWarning.TempoChanges,
      ImportWarning.TimeSignatureChanges,
      ImportWarning.RepeatsIgnored,
    ]);
    expect(written(music.tracks[0]!.notes).slice(0, 3)).toEqual([
      ['C4', 0, 0.25],
      ['D4', 0.25, 0.5],
      ['E4', 0.75, 0.25],
    ]);
  });

  it('keeps dynamics and hairpins, moved like the notes of a pickup bar', () => {
    const dynamic = (level: string, offset = '') =>
      `<direction placement="below"><direction-type><dynamics><${level}/></dynamics></direction-type>${offset}</direction>`;
    const wedge = (type: string) =>
      `<direction><direction-type><wedge type="${type}"/></direction-type></direction>`;
    const music = parseMusicXml(
      piece(
        `<measure number="0" implicit="yes">${attributes(
          '<divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time>',
        )}${dynamic('p')}${n('G4', 2)}</measure>`,
        measure(wedge('crescendo'), n('C5', 4), n('D5', 4)),
        measure(
          wedge('stop'),
          dynamic('f'),
          n('E5', 4),
          dynamic('mf', '<offset>2</offset>'),
          n('F5', 4),
        ),
      ),
    );
    // The pickup (one beat) is padded to a whole bar: everything moves 3 beats later.
    expect(music.dynamics).toEqual({
      marks: [
        { beat: 3, dynamic: 'p' },
        { beat: 8, dynamic: 'f' },
        { beat: 11, dynamic: 'mf' }, // after E5 (2 beats), plus its offset of 1 beat
      ],
      hairpins: [{ start: 4, end: 8, kind: 'crescendo' }],
    });
  });

  it('rejects what it can’t read', () => {
    const code = (text: string) => {
      try {
        parseMusicXml(text);
        return null;
      } catch (error) {
        return (error as { code?: string }).code;
      }
    };
    expect(code('<score-partwise><part')).toBe(ImportErrorCode.Unreadable);
    expect(code('<score-timewise version="4.0"/>')).toBe(ImportErrorCode.Unreadable);
    expect(code('<html><body/></html>')).toBe(ImportErrorCode.UnknownFormat);
    expect(code(piece(measure(rest(4))))).toBe(ImportErrorCode.NoNotes);
  });
});
