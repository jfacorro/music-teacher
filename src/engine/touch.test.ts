import { describe, expect, it } from 'vitest';
import { Articulation, Hand, type Score, type ScoreNote } from './score';
import { scoreOf } from './testUtils';
import { type KeyTouch, summarizeTouch, TouchKind, touchChecks } from './touch';

/** 60 BPM: a quarter note lasts 1000 ms. */
const TEMPO = 60;

/** A score of quarter notes C D E F G, with articulations and slurs added. */
function score(
  articulations: Partial<Record<number, Articulation[]>> = {},
  slurs: Score['slurs'] = [],
): Score {
  const base = scoreOf(
    [
      ['C4', 0],
      ['D4', 1],
      ['E4', 2],
      ['F4', 3],
      ['G4', 4],
    ],
    TEMPO,
  );
  return {
    ...base,
    notes: base.notes.map((note, i) =>
      articulations[i] ? { ...note, articulations: articulations[i] } : note,
    ),
    ...(slurs.length > 0 && { slurs }),
  };
}

/** Each note played: down at its beat (ms), held `held[i]` ms, at `velocity[i]`. */
function played(
  notes: readonly ScoreNote[],
  held: number[],
  velocity: number[] = [],
): Map<ScoreNote, KeyTouch> {
  return new Map(
    notes.map((note, i) => {
      const down = note.start * 1000;
      return [note, { down, up: down + (held[i] ?? 900), velocity: velocity[i] ?? 64 }];
    }),
  );
}

const kinds = (checks: ReturnType<typeof touchChecks>) =>
  checks.map(({ kind, bar, ok }) => [kind, bar, ok]);

describe('touch', () => {
  it('calls staccato notes short when let go before half their length', () => {
    const s = score({ 1: [Articulation.Staccato], 2: [Articulation.Staccato] });
    const checks = touchChecks(s, s.notes, played(s.notes, [900, 400, 700]), TEMPO);
    expect(kinds(checks)).toEqual([
      [TouchKind.Staccato, 0, true],
      [TouchKind.Staccato, 0, false],
    ]);
  });

  it('calls slurred notes connected when each key is held until the next goes down', () => {
    const s = score({}, [{ start: 0, end: 3, hand: Hand.Right }]);
    // C held into D (connected), D let go 300 ms early (a gap), E held 990 ms (just connected).
    const checks = touchChecks(s, s.notes, played(s.notes, [1050, 700, 990, 900]), TEMPO);
    expect(kinds(checks)).toEqual([
      [TouchKind.Legato, 0, true],
      [TouchKind.Legato, 0, false],
      [TouchKind.Legato, 0, true],
    ]);
  });

  it('leaves out a slurred note played again, which has to come up first', () => {
    const base = scoreOf(
      [
        ['C4', 0],
        ['C4', 1],
        ['D4', 2],
      ],
      TEMPO,
    );
    const s = { ...base, slurs: [{ start: 0, end: 2, hand: Hand.Right }] };
    const checks = touchChecks(s, s.notes, played(s.notes, [900, 1000]), TEMPO);
    expect(kinds(checks)).toEqual([[TouchKind.Legato, 0, true]]);
  });

  it('calls an accent right when it is clearly harder than the notes around it', () => {
    const s = score({ 1: [Articulation.Accent], 3: [Articulation.Accent] });
    const touches = played(s.notes, [], [60, 80, 60, 64, 62]);
    expect(kinds(touchChecks(s, s.notes, touches, TEMPO))).toEqual([
      [TouchKind.Accent, 0, true],
      [TouchKind.Accent, 0, false],
    ]);
  });

  it('calls tenuto notes held when they last nearly their whole length', () => {
    const s = score({ 0: [Articulation.Tenuto], 1: [Articulation.Tenuto] });
    const checks = touchChecks(s, s.notes, played(s.notes, [900, 600]), TEMPO);
    expect(kinds(checks).map(([, , ok]) => ok)).toEqual([true, false]);
  });

  it('sums up each kind, the bars to work on, and passes at three in four right', () => {
    const s = score(
      { 0: [Articulation.Staccato], 1: [Articulation.Staccato], 2: [Articulation.Staccato] },
      [],
    );
    const fourBars = { ...s, measures: s.notes.map((n) => ({ start: n.start, length: 1 })) };
    const summary = summarizeTouch(
      fourBars,
      fourBars.notes,
      played(fourBars.notes, [300, 800, 300]),
      TEMPO,
    );
    expect(summary).toEqual({
      kinds: [{ kind: TouchKind.Staccato, right: 2, total: 3 }],
      bars: [1],
      ok: false,
    });
  });

  it('has nothing to say without marks, or without keys measured (the microphone)', () => {
    const plain = score();
    expect(summarizeTouch(plain, plain.notes, played(plain.notes, []), TEMPO)).toBeNull();
    const marked = score({ 0: [Articulation.Staccato] });
    expect(summarizeTouch(marked, marked.notes, new Map(), TEMPO)).toBeNull();
  });
});
