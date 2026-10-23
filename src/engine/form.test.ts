import { describe, expect, it } from 'vitest';
import { playedMeasureOf, segmentsOf, unroll, writtenBeat, writtenMeasureOf } from './form';
import { formatNote } from '../theory/pitch';
import type { Score } from './score';
import { scoreOf } from './testUtils';

/** One whole note per bar: C, D, E, F, G (bars 1–5, beats 0–20). */
function fiveBars(repeats: Score['repeats']): Score {
  const base = scoreOf(
    (['C4', 'D4', 'E4', 'F4', 'G4'] as const).map((note, i) => [note, i * 4, 4]),
  );
  return { ...base, repeats };
}

const played = (score: Score) => score.notes.map((note) => formatNote(note.pitch)).join(' ');

describe('segmentsOf', () => {
  it('plays a repeated stretch twice', () => {
    expect(segmentsOf([{ start: 4, end: 12 }], 20)).toEqual([
      { from: 0, to: 12, at: 0 },
      { from: 4, to: 20, at: 12 },
    ]);
  });

  it('skips the first ending the second time, for the second', () => {
    const endings: [{ start: number; end: number }, { start: number; end: number }] = [
      { start: 8, end: 12 },
      { start: 12, end: 16 },
    ];
    expect(segmentsOf([{ start: 0, end: 12, endings }], 20)).toEqual([
      { from: 0, to: 12, at: 0 },
      { from: 0, to: 8, at: 12 },
      { from: 12, to: 20, at: 20 },
    ]);
  });
});

describe('unroll', () => {
  it('leaves music without repeats alone', () => {
    const score = fiveBars(undefined);
    expect(unroll(score)).toBe(score);
  });

  it('plays each note once per time through, keeping the written music', () => {
    const written = fiveBars([{ start: 4, end: 12 }]);
    const score = unroll(written);
    expect(played(score)).toBe('C4 D4 E4 D4 E4 F4 G4');
    expect(score.measures).toHaveLength(7);
    expect(score.repeats).toBeUndefined();
    expect(score.form?.written).toBe(written);
    const d = written.notes[1]!;
    expect(score.form?.copies.get(d)?.map((note) => note.start)).toEqual([4, 12]);
  });

  it('plays the first ending once and the second after the repeat', () => {
    const score = unroll(
      fiveBars([
        {
          start: 0,
          end: 12,
          endings: [
            { start: 8, end: 12 },
            { start: 12, end: 16 },
          ],
        },
      ]),
    );
    expect(played(score)).toBe('C4 D4 E4 C4 D4 F4 G4');
  });

  it('repeats the marks with the notes', () => {
    const score = unroll({
      ...fiveBars([{ start: 0, end: 8 }]),
      pedal: [{ down: 0, up: 4 }],
      ritardandos: [{ start: 16, end: 20 }],
    });
    expect(score.pedal).toEqual([
      { down: 0, up: 4 },
      { down: 8, up: 12 },
    ]);
    expect(score.ritardandos).toEqual([{ start: 24, end: 28 }]);
  });
});

describe('written and played positions', () => {
  const score = unroll(fiveBars([{ start: 4, end: 12 }]));
  const form = score.form!;

  it('finds where a beat played is written, going back at the repeat', () => {
    expect(writtenBeat(form, -2)).toBe(-2);
    expect(writtenBeat(form, 6)).toBe(6);
    expect(writtenBeat(form, 12)).toBe(4);
    expect(writtenBeat(form, 21)).toBe(13);
  });

  it('maps bars both ways, a written bar to where it’s first played', () => {
    expect(score.measures.map((measure) => writtenMeasureOf(form, measure))).toEqual([
      0, 1, 2, 1, 2, 3, 4,
    ]);
    expect([0, 1, 2, 3, 4].map((bar) => playedMeasureOf(form, score, bar))).toEqual([
      0, 1, 2, 5, 6,
    ]);
  });
});
