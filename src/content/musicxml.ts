/**
 * Score → MusicXML (PLAN.md §2.1), so every lesson and song can be shown as sheet music
 * (rendered by OpenSheetMusicDisplay). One piano part: a treble staff for the right hand and a
 * bass staff for the left hand (only the staves that have notes).
 *
 * Simplifications that fit the current content: each staff has one line at a time (notes
 * that start together form a chord); durations are multiples of a sixteenth note. A hand crossing
 * over the other writes those notes on the other hand's staff, which then holds both hands'
 * notes in its one line.
 */
import { HairpinKind } from '../engine/dynamics';
import {
  beatsPerMeasure,
  countedBeat,
  Hand,
  type Score,
  type ScoreNote,
  slurNotes,
} from '../engine/score';
import type { Pitch } from '../theory/pitch';

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

export interface MusicXmlOptions {
  /**
   * Hands that get a staff, even without notes (default: every hand with notes); other notes
   * are left out.
   */
  hands?: readonly Hand[];
  /** Text written under each note, e.g. its name for beginners (once per tied note). */
  noteLabel?: (note: ScoreNote) => string;
  /**
   * Rhythm only: one staff with a single line and a percussion clef, every note on the line
   * (written at its pitch, which positions it).
   */
  rhythm?: boolean;
  /** A picture of some notes rather than music: no rests and no bar lines are drawn. */
  illustration?: boolean;
  /**
   * Written over the first of a crossing hand's notes on the other staff, e.g. "L.H."
   * (nothing by default).
   */
  handLabel?: (hand: Hand) => string;
}

export const noteKey = (staff: number, startDivision: number, midi: number) =>
  `${staff}|${startDivision}|${midi}`;

interface Event {
  start: number; // divisions
  end: number;
  notes: ScoreNote[]; // empty = rest
}

/**
 * A dynamic or a hairpin's start or end, written under the top staff; or a pedal mark's start,
 * change or end, under the bottom one.
 */
interface Direction {
  at: number; // divisions
  /** The staff it's written with. */
  staff: number;
  /**
   * At the same spot: a hairpin's or pedal's end (0), then a level or pedal change (1), then a
   * hairpin's or pedal's start (2).
   */
  order: number;
  xml: string;
}

export function scoreToMusicXml(score: Score, options: MusicXmlOptions = {}): MusicXmlResult {
  const hands = [Hand.Right, Hand.Left].filter((hand) =>
    options.hands ? options.hands.includes(hand) : score.notes.some((n) => n.hand === hand),
  );
  const staves: StaffInfo[] = hands.map((hand, i) => ({ hand, number: i + 1 }));
  const measureDivs = Math.round(beatsPerMeasure(score.timeSignature) * DIVISIONS);
  const measureCount = Math.max(1, score.measures.length);
  const index = new Map<string, ScoreNote>();

  const staffOf = (hand: Hand) => staves.find((staff) => staff.hand === hand);
  /** Where a note is written: its hand's staff, or the other one when the hand crosses over. */
  const writtenOn = (note: ScoreNote) =>
    (note.crossed && staffOf(otherHand(note.hand))) || staffOf(note.hand);
  const linesByStaff = staves.map((staff) => ({
    staff,
    events: eventsFor(score.notes.filter((n) => writtenOn(n) === staff)),
  }));

  const directions = options.illustration
    ? []
    : [
        ...directionsFor(score, staves[0]),
        ...pedalFor(score, staves.at(-1)),
        ...handLabelsFor(score, writtenOn, options.handLabel),
        ...ritardandosFor(score, staves[0]),
      ].sort((a, b) => a.at - b.at || a.order - b.order);
  const slurs = slurMarks(score);
  const barlines = barlinesFor(score, measureCount);
  // Compound time is beamed here, in groups of three eighths: OSMD's automatic beams don't
  // group it. Other times are left to them.
  const beamEvery =
    countedBeat(score.timeSignature) === 1
      ? null
      : Math.round(countedBeat(score.timeSignature) * DIVISIONS);

  const measures: string[] = [];
  for (let m = 0; m < measureCount; m++) {
    const from = m * measureDivs;
    const to = from + measureDivs;
    const last = m === measureCount - 1;
    const parts: string[] = [];
    const barline = barlines.get(m);
    if (barline?.left) parts.push(barline.left);
    if (m === 0) parts.push(attributes(score, staves, options.rhythm ?? false));
    linesByStaff.forEach(({ staff, events }, i) => {
      if (i > 0) parts.push(`<backup><duration>${measureDivs}</duration></backup>`);
      // Directions go with their staff; the last bar also takes any after the music ends.
      const inBar = directions.filter(
        (d) => d.staff === staff.number && d.at >= from && (d.at < to || last),
      );
      parts.push(
        ...measureNotes(
          events,
          staff,
          from,
          to,
          index,
          options.noteLabel,
          options.rhythm ?? false,
          inBar,
          slurs,
          beamEvery,
        ),
      );
    });
    if (barline?.right) parts.push(barline.right);
    if (options.illustration) parts.push(NO_BAR_LINE);
    measures.push(`<measure number="${m + 1}">${parts.join('')}</measure>`);
  }

  const body = measures.join('');
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="4.0">' +
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
    `<part id="P1">${options.illustration ? hideRests(body) : body}</part>` +
    '</score-partwise>';
  return { xml, staves, notes: index };
}

const NO_BAR_LINE = '<barline location="right"><bar-style>none</bar-style></barline>';

/** Rests take their space but aren't drawn. */
const hideRests = (xml: string) => xml.replaceAll('<note><rest', '<note print-object="no"><rest');

/** Where a slur starts or stops: on which note, and its number (so two can overlap). */
interface SlurMark {
  type: 'start' | 'stop';
  number: number;
}

/** Each slur's first and last notes, numbered by hand (1–2 right, 3–4 left, alternating). */
function slurMarks(score: Score): Map<ScoreNote, SlurMark[]> {
  const marks = new Map<ScoreNote, SlurMark[]>();
  const counts = { [Hand.Right]: 0, [Hand.Left]: 0 };
  for (const slur of score.slurs ?? []) {
    const notes = slurNotes(score.notes, slur);
    const first = notes[0];
    const last = notes.at(-1);
    if (!first || !last || first === last) continue;
    const number = (counts[slur.hand]++ % 2) + (slur.hand === Hand.Right ? 1 : 3);
    marks.set(first, [...(marks.get(first) ?? []), { type: 'start', number }]);
    marks.set(last, [...(marks.get(last) ?? []), { type: 'stop', number }]);
  }
  return marks;
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
  noteLabel: MusicXmlOptions['noteLabel'],
  rhythm: boolean,
  directions: readonly Direction[],
  slurs: ReadonlyMap<ScoreNote, readonly SlurMark[]> = new Map(),
  beamEvery: number | null = null,
): string[] {
  const out: string[] = [];
  /** Notes shorter than a quarter, to beam: where each is written (a chord's first note). */
  const beamable: Beamable[] = [];
  let pending = 0;
  /** Writes the directions up to `at`, before what's written there. */
  const flush = (at: number) => {
    while (pending < directions.length && directions[pending]!.at <= at) {
      out.push(directions[pending++]!.xml);
    }
  };
  /** Rests from `start` to `end`, split where a direction falls inside them. */
  const restsBetween = (start: number, end: number) => {
    let at = start;
    flush(at);
    while (at < end) {
      const next = directions[pending];
      const stop = next && next.at < end ? next.at : end;
      out.push(...rests(stop - at, staff));
      at = stop;
      flush(at);
    }
  };

  const inMeasure = events.filter((e) => e.start < to && e.end > from);
  if (inMeasure.length === 0) {
    if (directions.some((d) => d.at > from && d.at < to)) restsBetween(from, to);
    else {
      flush(from);
      out.push(rest(to - from, staff, true));
    }
    flush(Infinity);
    return out;
  }
  let cursor = from;
  for (const event of inMeasure) {
    const start = Math.max(event.start, from);
    const end = Math.min(event.end, to);
    if (start > cursor) restsBetween(cursor, start);
    flush(start);
    const pieces = split(end - start);
    let at = start;
    pieces.forEach((value, i) => {
      const tieStop = at > event.start;
      const tieStart = i < pieces.length - 1 || event.end > to;
      if (beamEvery !== null && value.divs < DIVISIONS) {
        beamable.push({ index: out.length, at, divs: value.divs });
      }
      event.notes.forEach((note, n) => {
        index.set(noteKey(staff.number, at, note.pitch.midi), note);
        out.push(
          noteXml(note, value, staff, {
            chord: n > 0,
            tieStart,
            tieStop,
            fingering: !tieStop,
            // A tied note's slur starts on its first part and stops on its last.
            slurs: (slurs.get(note) ?? []).filter((mark) =>
              mark.type === 'start' ? !tieStop : !tieStart,
            ),
            // One fermata per chord, over its first written part.
            fermata: (note.fermata ?? false) && !tieStop && n === 0,
            rhythm,
            // Chord notes stack their labels on separate lines.
            label: !tieStop && noteLabel ? { text: noteLabel(note), line: n + 1 } : null,
          }),
        );
      });
      at += value.divs;
    });
    cursor = end;
  }
  if (cursor < to) restsBetween(cursor, to);
  flush(Infinity);
  if (beamEvery !== null) addBeams(out, beamable, from, beamEvery);
  return out;
}

/** A note to beam: its place among a bar's written elements, where it is and how long. */
interface Beamable {
  index: number;
  at: number;
  divs: number;
}

/**
 * Beams the notes shorter than a quarter that follow each other within a group of `every`
 * divisions from the bar's start; sixteenths get a second beam, or a hook when alone.
 */
function addBeams(out: string[], notes: readonly Beamable[], from: number, every: number): void {
  const groupOf = (note: Beamable) => Math.floor((note.at - from) / every);
  const runs: Beamable[][] = [];
  for (const note of notes) {
    const run = runs.at(-1);
    const before = run?.at(-1);
    if (run && before && groupOf(before) === groupOf(note) && before.at + before.divs === note.at) {
      run.push(note);
    } else {
      runs.push([note]);
    }
  }
  const sixteenth = (note: Beamable | undefined) =>
    note !== undefined && note.divs <= DIVISIONS / 4;
  for (const run of runs) {
    if (run.length < 2) continue;
    run.forEach((note, i) => {
      const first = `<beam number="1">${i === 0 ? 'begin' : i === run.length - 1 ? 'end' : 'continue'}</beam>`;
      let second = '';
      if (sixteenth(note)) {
        const before = sixteenth(run[i - 1]);
        const after = sixteenth(run[i + 1]);
        const kind =
          before && after
            ? 'continue'
            : before
              ? 'end'
              : after
                ? 'begin'
                : i === 0
                  ? 'forward hook'
                  : 'backward hook';
        second = `<beam number="2">${kind}</beam>`;
      }
      out[note.index] = out[note.index]!.replace('</staff>', `</staff>${first}${second}`);
    });
  }
}

/** The score's dynamics and hairpins as MusicXML directions for `staff`, by position. */
function directionsFor(score: Score, staff: StaffInfo | undefined): Direction[] {
  if (!staff || !score.dynamics) return [];
  const direction = (type: string) =>
    `<direction placement="below"><direction-type>${type}</direction-type>` +
    `<staff>${staff.number}</staff></direction>`;
  const divs = (beat: number) => Math.round(beat * DIVISIONS);
  return [
    ...score.dynamics.marks.map((mark) => ({
      at: divs(mark.beat),
      staff: staff.number,
      order: 1,
      xml: direction(`<dynamics><${mark.dynamic}/></dynamics>`),
    })),
    ...score.dynamics.hairpins.flatMap((hairpin) => [
      {
        at: divs(hairpin.start),
        staff: staff.number,
        order: 2,
        xml: direction(
          `<wedge type="${hairpin.kind === HairpinKind.Crescendo ? 'crescendo' : 'diminuendo'}"/>`,
        ),
      },
      {
        at: divs(hairpin.end),
        staff: staff.number,
        order: 0,
        xml: direction('<wedge type="stop"/>'),
      },
    ]),
  ];
}

/**
 * The pedal marks as MusicXML directions under `staff` (the bottom one): a bracket line from
 * where the pedal goes down to where it comes up, notched where it's changed.
 */
function pedalFor(score: Score, staff: StaffInfo | undefined): Direction[] {
  if (!staff) return [];
  const marks = score.pedal ?? [];
  const at = (beat: number) => Math.round(beat * DIVISIONS);
  const direction = (type: string, order: number, beat: number): Direction => ({
    at: at(beat),
    staff: staff.number,
    order,
    xml:
      '<direction placement="below"><direction-type>' +
      `<pedal type="${type}" line="yes"/></direction-type>` +
      `<staff>${staff.number}</staff></direction>`,
  });
  return marks.flatMap((mark, i) => {
    const changed = i > 0 && at(marks[i - 1]!.up) === at(mark.down);
    const changes = at(marks[i + 1]?.down ?? -1) === at(mark.up);
    return [
      direction(changed ? 'change' : 'start', changed ? 1 : 2, mark.down),
      ...(changes ? [] : [direction('stop', 0, mark.up)]),
    ];
  });
}

const otherHand = (hand: Hand) => (hand === Hand.Right ? Hand.Left : Hand.Right);

/** One side of a bar: its line's style, an ending's bracket, a repeat sign. */
interface Barline {
  style?: 'heavy-light' | 'light-heavy';
  ending?: { number: 1 | 2; type: 'start' | 'stop' | 'discontinue' };
  repeat?: 'forward' | 'backward';
}

const barlineXml = (location: 'left' | 'right', { style, ending, repeat }: Barline) =>
  `<barline location="${location}">` +
  (style ? `<bar-style>${style}</bar-style>` : '') +
  (ending ? `<ending number="${ending.number}" type="${ending.type}"/>` : '') +
  (repeat ? `<repeat direction="${repeat}"/>` : '') +
  '</barline>';

/**
 * Repeat signs and endings, by bar (from 0): what goes at its start and at its end. A repeat
 * from the very start has no sign there, as in printed music.
 */
function barlinesFor(
  score: Score,
  measureCount: number,
): Map<number, { left?: string; right?: string }> {
  const sides = new Map<number, { left?: Barline; right?: Barline }>();
  const length = beatsPerMeasure(score.timeSignature);
  const barAt = (beat: number) => Math.min(measureCount - 1, Math.round(beat / length));
  // The bar a repeat or ending closes on: the last one, when it closes at the end of the music.
  const lastBarBefore = (beat: number) => Math.min(measureCount, Math.round(beat / length)) - 1;
  const add = (bar: number, side: 'left' | 'right', barline: Barline) => {
    const current = sides.get(bar) ?? {};
    sides.set(bar, { ...current, [side]: { ...current[side], ...barline } });
  };
  for (const repeat of score.repeats ?? []) {
    if (repeat.start > 0)
      add(barAt(repeat.start), 'left', { style: 'heavy-light', repeat: 'forward' });
    const last = lastBarBefore(repeat.end);
    add(last, 'right', { style: 'light-heavy', repeat: 'backward' });
    if (!repeat.endings) continue;
    const [first, second] = repeat.endings;
    add(barAt(first.start), 'left', { ending: { number: 1, type: 'start' } });
    add(last, 'right', { ending: { number: 1, type: 'stop' } });
    add(barAt(second.start), 'left', { ending: { number: 2, type: 'start' } });
    add(lastBarBefore(second.end), 'right', { ending: { number: 2, type: 'discontinue' } });
  }
  return new Map(
    [...sides].map(([bar, { left, right }]) => [
      bar,
      {
        ...(left && { left: barlineXml('left', left) }),
        ...(right && { right: barlineXml('right', right) }),
      },
    ]),
  );
}

/** "rit." where the music slows down, and "a tempo" where it's back, if it goes on. */
function ritardandosFor(score: Score, staff: StaffInfo | undefined): Direction[] {
  if (!staff) return [];
  const words = (text: string, beat: number): Direction => ({
    at: Math.round(beat * DIVISIONS),
    staff: staff.number,
    order: 1,
    xml:
      '<direction placement="above"><direction-type>' +
      `<words font-style="italic">${text}</words></direction-type>` +
      `<staff>${staff.number}</staff></direction>`,
  });
  return (score.ritardandos ?? []).flatMap((rit) => [
    words('rit.', rit.start),
    ...(score.notes.some((note) => note.start >= rit.end - 1e-6)
      ? [words('a tempo', rit.end)]
      : []),
  ]);
}

/** "L.H." (or "R.H.") over the first note of each stretch a hand plays on the other's staff. */
function handLabelsFor(
  score: Score,
  writtenOn: (note: ScoreNote) => StaffInfo | undefined,
  label: MusicXmlOptions['handLabel'],
): Direction[] {
  if (!label) return [];
  const labels: Direction[] = [];
  for (const hand of [Hand.Right, Hand.Left]) {
    /** Whether the hand's note before was on the other staff (notes in a chord are alike). */
    let crossing = false;
    for (const note of score.notes.filter((n) => n.hand === hand)) {
      const staff = writtenOn(note);
      const crossed = staff !== undefined && staff.hand !== hand;
      if (crossed && !crossing && staff) {
        labels.push({
          at: Math.round(note.start * DIVISIONS),
          staff: staff.number,
          order: 1,
          xml:
            '<direction placement="above"><direction-type>' +
            `<words>${escapeXml(label(hand))}</words></direction-type>` +
            `<staff>${staff.number}</staff></direction>`,
        });
      }
      crossing = crossed;
    }
  }
  return labels;
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
    slurs = [],
    fermata = false,
    rhythm,
    label,
  }: {
    chord: boolean;
    tieStart: boolean;
    tieStop: boolean;
    fingering: boolean;
    slurs?: readonly SlurMark[];
    fermata?: boolean;
    rhythm: boolean;
    label: { text: string; line: number } | null;
  },
): string {
  const { step, alter, octave } = note.pitch;
  // Articulations go with the note's first written part, like its fingering.
  const articulations = fingering ? (note.articulations ?? []) : [];
  const notations = [
    tieStop ? '<tied type="stop"/>' : '',
    tieStart ? '<tied type="start"/>' : '',
    ...slurs.map((mark) => `<slur type="${mark.type}" number="${mark.number}"/>`),
    // Over the top staff, under the bottom one.
    fermata ? `<fermata type="${staff.number === 1 ? 'upright' : 'inverted'}"/>` : '',
    articulations.length > 0
      ? `<articulations>${articulations.map((name) => `<${name}/>`).join('')}</articulations>`
      : '',
    fingering && note.finger ? `<technical><fingering>${note.finger}</fingering></technical>` : '',
  ].join('');
  return (
    '<note>' +
    (chord ? '<chord/>' : '') +
    (rhythm
      ? `<unpitched><display-step>${step}</display-step><display-octave>${octave}</display-octave></unpitched>`
      : `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`) +
    `<duration>${value.divs}</duration>` +
    (tieStop ? '<tie type="stop"/>' : '') +
    (tieStart ? '<tie type="start"/>' : '') +
    `<voice>${voiceOf(staff)}</voice>` +
    `<type>${value.type}</type>${'<dot/>'.repeat(value.dots)}` +
    // Rhythms read best with every stem up.
    (rhythm ? '<stem>up</stem>' : '') +
    `<staff>${staff.number}</staff>` +
    (notations ? `<notations>${notations}</notations>` : '') +
    (label
      ? `<lyric number="${label.line}"><syllabic>single</syllabic><text>${escapeXml(label.text)}</text></lyric>`
      : '') +
    '</note>'
  );
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function voiceOf(staff: StaffInfo): number {
  return staff.number === 1 ? 1 : 5;
}

function attributes(score: Score, staves: StaffInfo[], rhythm: boolean): string {
  const [beats, beatType] = score.timeSignature;
  const clefs = rhythm
    ? '<clef number="1"><sign>percussion</sign></clef>' +
      '<staff-details number="1"><staff-lines>1</staff-lines></staff-details>'
    : staves
        .map(({ hand, number }) =>
          hand === Hand.Right
            ? `<clef number="${number}"><sign>G</sign><line>2</line></clef>`
            : `<clef number="${number}"><sign>F</sign><line>4</line></clef>`,
        )
        .join('');
  return (
    '<attributes>' +
    `<divisions>${DIVISIONS}</divisions>` +
    `<key><fifths>${score.keyFifths ?? 0}</fifths></key>` +
    `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
    `<staves>${staves.length}</staves>` +
    clefs +
    '</attributes>' +
    `<sound tempo="${score.tempo}"/>`
  );
}

export const Clef = {
  Treble: 'treble',
  Bass: 'bass',
} as const;
export type Clef = (typeof Clef)[keyof typeof Clef];

/** A single whole note on a treble or bass staff, without a time signature: a quiz card. */
export function noteCardXml({ step, alter, octave }: Pitch, clef: Clef): string {
  const accidental = alter === 1 ? 'sharp' : alter === -1 ? 'flat' : null;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="4.0">' +
    '<part-list><score-part id="P1"><part-name>Note</part-name></score-part></part-list>' +
    '<part id="P1"><measure number="1">' +
    '<attributes><divisions>1</divisions><key><fifths>0</fifths></key>' +
    '<time print-object="no"><beats>4</beats><beat-type>4</beat-type></time>' +
    (clef === Clef.Treble
      ? '<clef><sign>G</sign><line>2</line></clef>'
      : '<clef><sign>F</sign><line>4</line></clef>') +
    '</attributes>' +
    '<note>' +
    `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>` +
    '<duration>4</duration><type>whole</type>' +
    (accidental ? `<accidental>${accidental}</accidental>` : '') +
    '</note>' +
    '<barline location="right"><bar-style>none</bar-style></barline>' +
    '</measure></part></score-partwise>'
  );
}
