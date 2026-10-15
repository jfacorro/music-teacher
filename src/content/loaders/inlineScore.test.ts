import { describe, expect, it } from 'vitest';
import { ScoreError, parseInlineScore } from './inlineScore';

const valid = {
  tempo: 100,
  timeSignature: [4, 4],
  notes: [
    { note: 'D4', start: 1, duration: 1, hand: 'R', finger: 2 },
    { note: 'C4', start: 0, duration: 1, hand: 'R', finger: 1 },
    { note: 'C3', start: 0, duration: 4, hand: 'L' },
    { note: 'Db4', start: 2, duration: 2.5, hand: 'R' },
  ],
};

const withNote = (patch: Record<string, unknown>) => ({
  ...valid,
  notes: [valid.notes[0], { ...valid.notes[1], ...patch }],
});

describe('parseInlineScore', () => {
  it('parses notes into pitches, keeping spelling and fingering', () => {
    const score = parseInlineScore(valid, 'test');
    expect(score.tempo).toBe(100);
    expect(score.timeSignature).toEqual([4, 4]);
    expect(score.notes.map((n) => n.pitch.midi)).toEqual([48, 60, 62, 61]);
    expect(score.notes[3]?.pitch).toMatchObject({ step: 'D', alter: -1 });
    expect(score.notes[1]).toMatchObject({ start: 0, duration: 1, hand: 'R', finger: 1 });
    expect(score.notes[0]).not.toHaveProperty('finger');
  });

  it('sorts notes by start, then pitch', () => {
    const score = parseInlineScore(valid, 'test');
    expect(score.notes.map((n) => [n.start, n.pitch.midi])).toEqual([
      [0, 48],
      [0, 60],
      [1, 62],
      [2, 61],
    ]);
  });

  it('builds whole measures up to the last note', () => {
    expect(parseInlineScore(valid, 'test').measures).toEqual([
      { start: 0, length: 4 },
      { start: 4, length: 4 },
    ]);
  });

  it('measures in quarter-note beats for any time signature', () => {
    const score = parseInlineScore({ ...valid, timeSignature: [6, 8] }, 'test');
    expect(score.measures.map((m) => m.length)).toEqual([3, 3]);
  });

  it('does not add a measure when the last note ends on a barline', () => {
    const score = parseInlineScore(
      { ...valid, notes: [{ note: 'C4', start: 0, duration: 4, hand: 'R' }] },
      'test',
    );
    expect(score.measures).toHaveLength(1);
  });

  it.each([
    ['an invalid note', withNote({ note: 'H4' }), 'song "x" › notes[1] › note: Invalid note "H4"'],
    ['a missing note', withNote({ note: undefined }), 'song "x" › notes[1] › note'],
    ['a negative start', withNote({ start: -1 }), 'song "x" › notes[1] › start'],
    ['a zero duration', withNote({ duration: 0 }), 'song "x" › notes[1] › duration'],
    ['a bad hand', withNote({ hand: 'X' }), 'song "x" › notes[1] › hand'],
    ['a bad finger', withNote({ finger: 6 }), 'song "x" › notes[1] › finger'],
    ['a bad time signature', { ...valid, timeSignature: [4, 3] }, 'song "x" › timeSignature'],
    ['a missing tempo', { ...valid, tempo: undefined }, 'song "x" › tempo'],
    ['no notes', { ...valid, notes: [] }, 'song "x" › notes'],
    ['a non-object', 'nope', 'song "x"'],
  ])('rejects %s with its location', (_, input, message) => {
    expect(() => parseInlineScore(input, 'song "x"')).toThrow(ScoreError);
    expect(() => parseInlineScore(input, 'song "x"')).toThrow(message);
  });
});

describe('markings', () => {
  const base = {
    tempo: 90,
    timeSignature: [4, 4],
    notes: [{ note: 'C4', start: 0, duration: 1, hand: 'R' }],
  };

  it('reads the Italian markings of a score', () => {
    expect(parseInlineScore({ ...base, markings: ['moderato', 'mf'] }, 'x').markings).toEqual([
      'moderato',
      'mf',
    ]);
    expect(parseInlineScore(base, 'x').markings).toBeUndefined();
  });

  it('rejects unknown markings with their location', () => {
    expect(() => parseInlineScore({ ...base, markings: ['fast'] }, 'x')).toThrow(
      'x › markings › [0]: unknown marking "fast"',
    );
  });
});

describe('dynamics', () => {
  it('reads levels and hairpins, sorted', () => {
    const score = parseInlineScore(
      {
        ...valid,
        dynamics: [
          { beat: 4, mark: 'f' },
          { beat: 0, mark: 'p' },
        ],
        hairpins: [{ from: 2, to: 4, kind: 'crescendo' }],
      },
      'test',
    );
    expect(score.dynamics).toEqual({
      marks: [
        { beat: 0, dynamic: 'p' },
        { beat: 4, dynamic: 'f' },
      ],
      hairpins: [{ start: 2, end: 4, kind: 'crescendo' }],
    });
    expect(parseInlineScore(valid, 'test')).not.toHaveProperty('dynamics');
  });

  it('rejects what isn’t a dynamic or a hairpin, with its location', () => {
    expect(() =>
      parseInlineScore({ ...valid, dynamics: [{ beat: 0, mark: 'allegro' }] }, 'song'),
    ).toThrow('song › dynamics[0] › mark: expected a dynamic: pp, p, mp, mf, f or ff');
    expect(() =>
      parseInlineScore({ ...valid, hairpins: [{ from: 4, to: 2, kind: 'crescendo' }] }, 'song'),
    ).toThrow('song › hairpins[0] › to: expected a number > 4');
    expect(() =>
      parseInlineScore({ ...valid, hairpins: [{ from: 0, to: 2, kind: 'louder' }] }, 'song'),
    ).toThrow('song › hairpins[0] › kind: expected "crescendo" or "diminuendo"');
    expect(() =>
      parseInlineScore(
        {
          ...valid,
          hairpins: [
            { from: 0, to: 4, kind: 'crescendo' },
            { from: 2, to: 6, kind: 'diminuendo' },
          ],
        },
        'song',
      ),
    ).toThrow('song › hairpins: hairpins must not overlap');
  });
});
