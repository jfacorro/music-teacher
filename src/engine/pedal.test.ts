import { describe, expect, it } from 'vitest';
import { pedalChecks, PedalKind, type PedalPress, summarizePedal } from './pedal';
import type { PedalMark, Score, ScoreNote } from './score';
import { scoreOf } from './testUtils';
import type { KeyTouch } from './touch';

/** 60 BPM: a beat lasts 1000 ms. */
const TEMPO = 60;

/** Quarter notes C4 to C5 (beats 0–7, two bars), with pedal marks. */
function score(pedal: PedalMark[]): Score {
  const base = scoreOf(
    (['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'] as const).map((note, i) => [note, i]),
    TEMPO,
  );
  return { ...base, ...(pedal.length > 0 && { pedal }) };
}

/** Every note played on its beat, held 900 ms. */
function played(notes: readonly ScoreNote[]): Map<ScoreNote, KeyTouch> {
  return new Map(
    notes.map((note) => [
      note,
      { down: note.start * 1000, up: note.start * 1000 + 900, velocity: 64 },
    ]),
  );
}

/** The pedal down (true) or up at these times (ms), on the beat the music was at then. */
const pedal = (...presses: [boolean, number][]): PedalPress[] =>
  presses.map(([down, time]) => ({ down, time, beat: time / 1000 }));

/** Held over beats 0–2, changed at 2, held to 4; the second bar without it. */
const MARKS: PedalMark[] = [
  { down: 0, up: 2 },
  { down: 2, up: 4 },
];

function checks(presses: PedalPress[], marks = MARKS) {
  const s = score(marks);
  return pedalChecks(marks, s.notes, played(s.notes), presses, 8, s.measures).map(
    ({ kind, bar, ok }) => [kind, bar, ok],
  );
}

describe('pedal', () => {
  it('checks each mark’s down and up, and the notes outside the marks', () => {
    expect(checks(pedal([true, 100], [false, 2000], [true, 2200], [false, 4000]))).toEqual([
      [PedalKind.Down, 0, true],
      [PedalKind.Up, 0, true],
      [PedalKind.Down, 0, true],
      [PedalKind.Up, 1, true],
      // Beat 4 is where the pedal comes up: its note isn't checked.
      [PedalKind.Off, 1, true],
      [PedalKind.Off, 1, true],
      [PedalKind.Off, 1, true],
    ]);
  });

  it('wants a change pressed again after the new notes, not before them', () => {
    const result = checks(pedal([true, 100], [false, 1900], [true, 1950], [false, 4000]));
    expect(result.slice(0, 4)).toEqual([
      [PedalKind.Down, 0, true],
      [PedalKind.Up, 0, true],
      [PedalKind.Down, 0, false],
      [PedalKind.Up, 1, true],
    ]);
  });

  it('misses a change when the pedal is held through it', () => {
    const result = checks(pedal([true, 100], [false, 4000]));
    expect(result.slice(0, 4)).toEqual([
      [PedalKind.Down, 0, true],
      [PedalKind.Up, 0, false],
      [PedalKind.Down, 0, false],
      [PedalKind.Up, 1, true],
    ]);
  });

  it('allows a quarter of a beat early and half a beat late', () => {
    const at = (time: number) => checks(pedal([true, time]), [{ down: 1, up: 8 }])[0];
    expect(at(750)).toEqual([PedalKind.Down, 0, true]);
    expect(at(700)).toEqual([PedalKind.Down, 0, false]);
    expect(at(1500)).toEqual([PedalKind.Down, 0, true]);
    expect(at(1600)).toEqual([PedalKind.Down, 0, false]);
  });

  it('allows no later than the next note', () => {
    const s = scoreOf(
      [
        ['C4', 0],
        ['D4', 0.25],
        ['E4', 1],
      ],
      TEMPO,
    );
    const marks = [{ down: 0, up: 4 }];
    const at = (time: number) =>
      pedalChecks(marks, s.notes, played(s.notes), pedal([true, time]), 4, s.measures)[0]?.ok;
    expect(at(250)).toBe(true);
    expect(at(300)).toBe(false);
  });

  it('calls notes outside the marks blurred when they start with the pedal down', () => {
    const result = checks(
      pedal([true, 100], [false, 2000], [true, 2200], [false, 4000], [true, 5500], [false, 6500]),
    );
    expect(result.slice(4)).toEqual([
      [PedalKind.Off, 1, true],
      [PedalKind.Off, 1, false],
      [PedalKind.Off, 1, true],
    ]);
  });

  it('doesn’t check an up at the end of the music', () => {
    expect(checks(pedal([true, 0]), [{ down: 0, up: 8 }])).toEqual([[PedalKind.Down, 0, true]]);
  });
});

describe('pedal summary', () => {
  it('counts each kind and the bars to work on', () => {
    const s = score(MARKS);
    const summary = summarizePedal(
      s,
      s.notes,
      played(s.notes),
      pedal([true, 100], [false, 4000], [true, 5500], [false, 6500]),
    );
    expect(summary).toEqual({
      kinds: [
        { kind: PedalKind.Down, right: 1, total: 2 },
        { kind: PedalKind.Up, right: 1, total: 2 },
        { kind: PedalKind.Off, right: 2, total: 3 },
      ],
      bars: [0, 1],
      ok: false,
      silent: false,
    });
  });

  it('passes when three in four of each kind are right', () => {
    const s = score(MARKS);
    const summary = summarizePedal(
      s,
      s.notes,
      played(s.notes),
      pedal([true, 100], [false, 2000], [true, 2200], [false, 4000]),
    );
    expect(summary?.ok).toBe(true);
    expect(summary?.bars).toEqual([]);
  });

  it('says when the pedal wasn’t heard at all', () => {
    const s = score(MARKS);
    expect(summarizePedal(s, s.notes, played(s.notes), [])?.silent).toBe(true);
  });

  it('has nothing to say without marks or without a MIDI keyboard', () => {
    const plain = score([]);
    expect(summarizePedal(plain, plain.notes, played(plain.notes), pedal([true, 0]))).toBeNull();
    const marked = score(MARKS);
    expect(summarizePedal(marked, marked.notes, new Map(), pedal([true, 0]))).toBeNull();
  });
});
