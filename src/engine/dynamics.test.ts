import { describe, expect, it } from 'vitest';
import {
  dynamicAt,
  hairpinAt,
  HairpinKind,
  Loudness,
  loudnessOf,
  type ScoreDynamics,
  summarizeDynamics,
} from './dynamics';
import type { ScoreNote } from './score';
import { scoreOf, type NoteSpec } from './testUtils';

/** One note per beat, 4/4: bar 1 is beats 0–3, bar 2 beats 4–7, … */
const eightBeats: NoteSpec[] = Array.from({ length: 12 }, (_, i) => ['C4', i]);

function played(velocities: number[], dynamics: ScoreDynamics) {
  const score = scoreOf(eightBeats.slice(0, velocities.length));
  const map = new Map<ScoreNote, number>(score.notes.map((note, i) => [note, velocities[i]!]));
  return summarizeDynamics(dynamics, score.notes, map, score.measures);
}

const pThenF: ScoreDynamics = {
  marks: [
    { beat: 0, dynamic: 'p' },
    { beat: 4, dynamic: 'f' },
  ],
  hairpins: [],
};

describe('dynamics in a score', () => {
  it('finds the level and hairpin at a beat', () => {
    const dynamics: ScoreDynamics = {
      ...pThenF,
      hairpins: [{ start: 2, end: 4, kind: HairpinKind.Crescendo }],
    };
    expect(dynamicAt(dynamics, -1)).toBeNull();
    expect(dynamicAt(dynamics, 3.5)).toBe('p');
    expect(dynamicAt(dynamics, 4)).toBe('f');
    expect(hairpinAt(dynamics, 2)?.kind).toBe(HairpinKind.Crescendo);
    expect(hairpinAt(dynamics, 4)).toBeNull();
  });

  it('tells whether a velocity sounds like a level', () => {
    expect(loudnessOf(40, 'p')).toBe(Loudness.Right);
    expect(loudnessOf(90, 'p')).toBe(Loudness.TooLoud);
    expect(loudnessOf(60, 'f')).toBe(Loudness.TooSoft);
  });
});

describe('summarizeDynamics', () => {
  it('passes soft and loud passages played that way', () => {
    const summary = played([40, 42, 38, 45, 95, 100, 98, 102], pThenF);
    expect(summary?.passages.map((p) => [p.dynamic, p.bar, p.velocity, p.ok])).toEqual([
      ['p', 0, 41.25, true],
      ['f', 1, 98.75, true],
    ]);
    expect(summary?.ok).toBe(true);
  });

  it('flags a passage that’s neither in its band nor louder than the one before', () => {
    const summary = played([70, 70, 70, 70, 72, 72, 72, 72], pThenF);
    expect(summary?.passages.map((p) => [p.loudness, p.ok])).toEqual([
      [Loudness.TooLoud, false],
      [Loudness.TooSoft, false],
    ]);
    expect(summary?.ok).toBe(false);
  });

  it('accepts a clear contrast on a keyboard with a lighter touch', () => {
    // f at 70 is below the f band, but clearly louder than the p before it.
    const summary = played([45, 45, 45, 45, 70, 70, 70, 70], pThenF);
    expect(summary?.passages[1]).toMatchObject({ loudness: Loudness.TooSoft, ok: true });
  });

  it('checks that a crescendo gets louder and a diminuendo softer', () => {
    const cresc: ScoreDynamics = {
      marks: [],
      hairpins: [{ start: 0, end: 5, kind: HairpinKind.Crescendo }],
    };
    expect(played([40, 50, 60, 75, 90, 100], cresc)?.hairpins[0]).toMatchObject({
      kind: HairpinKind.Crescendo,
      firstBar: 0,
      lastBar: 1,
      from: 45,
      to: 95,
      ok: true,
    });
    expect(played([60, 60, 62, 61, 60, 60], cresc)?.hairpins[0]?.ok).toBe(false);
    const dim: ScoreDynamics = {
      marks: [],
      hairpins: [{ start: 0, end: 5, kind: HairpinKind.Diminuendo }],
    };
    expect(played([100, 90, 75, 60, 50, 40], dim)?.hairpins[0]?.ok).toBe(true);
  });

  it('leaves the notes of a hairpin out of the passages around it', () => {
    const dynamics: ScoreDynamics = {
      marks: [
        { beat: 0, dynamic: 'p' },
        { beat: 8, dynamic: 'f' },
      ],
      hairpins: [{ start: 4, end: 8, kind: HairpinKind.Crescendo }],
    };
    const summary = played([40, 40, 40, 40, 50, 65, 80, 95, 100, 100, 100, 100], dynamics);
    expect(summary?.passages.map((p) => [p.dynamic, p.velocity])).toEqual([
      ['p', 40],
      ['f', 100],
    ]);
    expect(summary?.hairpins[0]?.ok).toBe(true);
    expect(summary?.ok).toBe(true);
  });

  it('has nothing to say without dynamics or velocities', () => {
    const score = scoreOf(eightBeats.slice(0, 4));
    expect(summarizeDynamics(undefined, score.notes, new Map(), score.measures)).toBeNull();
    expect(summarizeDynamics(pThenF, score.notes, new Map(), score.measures)).toBeNull();
  });
});
