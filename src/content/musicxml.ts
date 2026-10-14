/**
 * Score → MusicXML (PLAN.md §2.1), so every lesson and song can be shown as sheet music
 * (rendered by OpenSheetMusicDisplay). One piano part: a treble staff for the right hand and a
 * bass staff for the left hand (only the staves that have notes).
 *
 * Simplifications that fit the current content: each hand plays one line at a time (notes
 * that start together form a chord); durations are multiples of a sixteenth note; key of C.
 */
import { beatsPerMeasure, type Hand, type Score, type ScoreNote } from '../engine/score';

/** Divisions per quarter note: sixteenths (3) and eighth-note triplets (4) are whole numbers. */
export const DIVISIONS = 12;

/** Note values from longest to shortest, in divisions. */
const NOTE_VALUES: readonly { divs: number; type: string; dots: number }[] = [
  { divs: 72, type: 'whole', dots: 1 },
  { divs: 48, type: 'whole', dots: 0 },
  { divs: 36, type: 'half', dots: 1 },
  { divs: 24, type: 'half', dots: 0 },
  { divs: 18, type: 'quarter', dots: 1 },
  { divs: 12, type: 'quarter', dots: 0 },
  { divs: 9, type: 'eighth', dots: 1 },
  { divs: 6, type: 'eighth', dots: 0 },
  { divs: 3, type: '16th', dots: 0 },
];

export interface StaffInfo {
  hand: Hand;
  /** 1-based staff number in the part. */
  number: number;
}

export interface MusicXmlResult {
  xml: string;
  staves: StaffInfo[];
  /**
   * The score note behind each written note: key `${staff}|${startDivision}|${midi}`, so a
   * rendered note can be traced back (tied continuations included).
   */
  notes: Map<string, ScoreNote>;
}

export const noteKey = (staff: number, startDivision: number, midi: number) =>
  `${staff}|${startDivision}|${midi}`;

interface Event {
  start: number; // divisions
  end: number;
  notes: ScoreNote[]; // empty = rest
}

export function scoreToMusicXml(score: Score): MusicXmlResult {
  const hands = (['R', 'L'] as const).filter((hand) => score.notes.some((n) => n.hand === hand));
  const staves: StaffInfo[] = hands.map((hand, i) => ({ hand, number: i + 1 }));
  const measureDivs = Math.round(beatsPerMeasure(score.timeSignature) * DIVISIONS);
  const measureCount = Math.max(1, score.measures.length);
  const index = new Map<string, ScoreNote>();

  const linesByStaff = staves.map((staff) => ({
    staff,
    events: eventsFor(score.notes.filter((n) => n.hand === staff.hand)),
  }));

  const measures: string[] = [];
  for (let m = 0; m < measureCount; m++) {
    const from = m * measureDivs;
    const to = from + measureDivs;
    const parts: string[] = [];
    if (m === 0) parts.push(attributes(score, staves));
    linesByStaff.forEach(({ staff, events }, i) => {
      if (i > 0) parts.push(`<backup><duration>${measureDivs}</duration></backup>`);
      parts.push(...measureNotes(events, staff, from, to, index));
    });
    measures.push(`<measure number="${m + 1}">${parts.join('')}</measure>`);
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="4.0">' +
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
    `<part id="P1">${measures.join('')}</part>` +
    '</score-partwise>';
  return { xml, staves, notes: index };
}

/** One hand's notes as a single line of events (chords grouped, overlaps cut). */
function eventsFor(notes: readonly ScoreNote[]): Event[] {
  const events: Event[] = [];
  for (const note of [...notes].sort((a, b) => a.start - b.start)) {
    const start = Math.round(note.start * DIVISIONS);
    const end = Math.round((note.start + note.duration) * DIVISIONS);
    const last = events.at(-1);
    if (last && last.start === start) {
      last.notes.push(note);
      continue;
    }
    if (last && last.end > start) last.end = start; // one line per hand
    events.push({ start, end, notes: [note] });
  }
  return events;
}

function measureNotes(
  events: readonly Event[],
  staff: StaffInfo,
  from: number,
  to: number,
  index: Map<string, ScoreNote>,
): string[] {
  const out: string[] = [];
  const inMeasure = events.filter((e) => e.start < to && e.end > from);
  if (inMeasure.length === 0) {
    out.push(rest(to - from, staff, true));
    return out;
  }
  let cursor = from;
  for (const event of inMeasure) {
    const start = Math.max(event.start, from);
    const end = Math.min(event.end, to);
    if (start > cursor) out.push(...rests(start - cursor, staff));
    const pieces = split(end - start);
    let at = start;
    pieces.forEach((value, i) => {
      const tieStop = at > event.start;
      const tieStart = i < pieces.length - 1 || event.end > to;
      event.notes.forEach((note, n) => {
        index.set(noteKey(staff.number, at, note.pitch.midi), note);
        out.push(
          noteXml(note, value, staff, { chord: n > 0, tieStart, tieStop, fingering: !tieStop }),
        );
      });
      at += value.divs;
    });
    cursor = end;
  }
  if (cursor < to) out.push(...rests(to - cursor, staff));
  return out;
}

/** A length in divisions as written note values (longest first). */
function split(divs: number): (typeof NOTE_VALUES)[number][] {
  const values: (typeof NOTE_VALUES)[number][] = [];
  let left = divs;
  while (left > 0) {
    const value = NOTE_VALUES.find((v) => v.divs <= left) ?? NOTE_VALUES.at(-1)!;
    values.push(value);
    left -= value.divs;
  }
  return values;
}

function rests(divs: number, staff: StaffInfo): string[] {
  return split(divs).map((value) => rest(value.divs, staff, false, value));
}

function rest(
  divs: number,
  staff: StaffInfo,
  wholeMeasure: boolean,
  value?: (typeof NOTE_VALUES)[number],
): string {
  return (
    '<note>' +
    (wholeMeasure ? '<rest measure="yes"/>' : '<rest/>') +
    `<duration>${divs}</duration>` +
    `<voice>${voiceOf(staff)}</voice>` +
    (value ? `<type>${value.type}</type>${'<dot/>'.repeat(value.dots)}` : '') +
    `<staff>${staff.number}</staff>` +
    '</note>'
  );
}

function noteXml(
  note: ScoreNote,
  value: (typeof NOTE_VALUES)[number],
  staff: StaffInfo,
  {
    chord,
    tieStart,
    tieStop,
    fingering,
  }: { chord: boolean; tieStart: boolean; tieStop: boolean; fingering: boolean },
): string {
  const { step, alter, octave } = note.pitch;
  const notations = [
    tieStop ? '<tied type="stop"/>' : '',
    tieStart ? '<tied type="start"/>' : '',
    fingering && note.finger ? `<technical><fingering>${note.finger}</fingering></technical>` : '',
  ].join('');
  return (
    '<note>' +
    (chord ? '<chord/>' : '') +
    `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>` +
    `<duration>${value.divs}</duration>` +
    (tieStop ? '<tie type="stop"/>' : '') +
    (tieStart ? '<tie type="start"/>' : '') +
    `<voice>${voiceOf(staff)}</voice>` +
    `<type>${value.type}</type>${'<dot/>'.repeat(value.dots)}` +
    `<staff>${staff.number}</staff>` +
    (notations ? `<notations>${notations}</notations>` : '') +
    '</note>'
  );
}

function voiceOf(staff: StaffInfo): number {
  return staff.number === 1 ? 1 : 5;
}

function attributes(score: Score, staves: StaffInfo[]): string {
  const [beats, beatType] = score.timeSignature;
  const clefs = staves
    .map(({ hand, number }) =>
      hand === 'R'
        ? `<clef number="${number}"><sign>G</sign><line>2</line></clef>`
        : `<clef number="${number}"><sign>F</sign><line>4</line></clef>`,
    )
    .join('');
  return (
    '<attributes>' +
    `<divisions>${DIVISIONS}</divisions>` +
    '<key><fifths>0</fifths></key>' +
    `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
    `<staves>${staves.length}</staves>` +
    clefs +
    '</attributes>' +
    `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome></direction-type><sound tempo="${score.tempo}"/></direction>`
  );
}
