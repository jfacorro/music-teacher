import { describe, expect, it } from 'vitest';
import { PracticeSession, type SessionOptions } from './session';
import { noteOff, noteOn, scoreOf, type NoteSpec } from './testUtils';
import { Transport } from './transport';

const C3 = 48;
const C4 = 60;
const D4 = 62;
const E4 = 64;

/** 60 BPM: one beat per second, so positions read as seconds. */
function setup(specs: NoteSpec[], options: Partial<SessionOptions> = {}) {
  const score = scoreOf(specs, 60);
  let now = 0;
  const transport = new Transport(score.tempo, () => now);
  const session = new PracticeSession(score, transport, {
    mode: 'tempo',
    hands: 'both',
    leadIn: 2,
    ...options,
  });
  return {
    score,
    transport,
    session,
    /** Moves the clock to `beat` (assuming uninterrupted playback) and ticks. */
    at(beat: number) {
      now += (beat - transport.position()) * 1000;
      session.tick();
    },
    press(pitch: number) {
      session.handleNote(noteOn(pitch, now));
    },
    release(pitch: number) {
      session.handleNote(noteOff(pitch, now));
    },
    get now() {
      return now;
    },
    wait(ms: number) {
      now += ms;
      session.tick();
    },
  };
}

const melody: NoteSpec[] = [
  ['C4', 0],
  ['D4', 1],
  ['E4', 2],
];

describe('PracticeSession: tempo mode', () => {
  it('starts after a one-measure count-in (or the lead-in, if longer)', () => {
    expect(setup(melody, { leadIn: 2 }).transport.position()).toBe(-4);
    expect(setup(melody, { leadIn: 6 }).transport.position()).toBe(-6);
  });

  it('counts in 1–4 before the music starts', () => {
    const t = setup(melody);
    t.session.play();
    const counts: (number | null)[] = [];
    for (const beat of [-3.9, -3, -2.5, -1, -0.1, 0]) {
      t.at(beat);
      counts.push(t.session.getState().countIn);
    }
    expect(counts).toEqual([1, 2, 2, 4, 4, null]);
  });

  it('grades a perfect run with three stars', () => {
    const t = setup(melody);
    t.session.play();
    for (const [beat, pitch] of [
      [0.02, C4],
      [0.98, D4],
      [2, E4],
    ] as const) {
      t.at(beat);
      t.press(pitch);
      t.release(pitch);
    }
    expect(t.session.getState().streak).toBe(3);
    expect(t.session.getState().feedback?.value).toEqual({
      kind: 'hit',
      grade: 'perfect',
      timing: 'onTime',
    });
    t.at(3);
    const { status, summary } = t.session.getState();
    expect(status).toBe('finished');
    expect(summary).toMatchObject({ expected: 3, perfect: 3, accuracy: 1, stars: 3 });
    expect(t.transport.playing).toBe(false);
  });

  it('reports early and late notes', () => {
    const t = setup(melody);
    t.session.play();
    t.at(-0.08);
    t.press(C4);
    expect(t.session.getState().feedback?.value).toEqual({
      kind: 'hit',
      grade: 'good',
      timing: 'early',
    });
    t.at(1.13);
    t.press(D4);
    expect(t.session.getState().feedback?.value).toMatchObject({ grade: 'ok', timing: 'late' });
  });

  it('marks wrong keys while held and breaks the streak', () => {
    const t = setup(melody);
    t.session.play();
    t.at(0);
    t.press(C4);
    t.press(E4);
    expect(t.session.getState().marks).toEqual(
      new Map([
        [C4, 'correct'],
        [E4, 'wrong'],
      ]),
    );
    expect(t.session.getState().streak).toBe(0);
    expect(t.session.getState().feedback?.value).toEqual({ kind: 'wrong' });
    t.release(E4);
    expect(t.session.getState().marks.has(E4)).toBe(false);
  });

  it('misses notes nobody plays', () => {
    const t = setup(melody);
    t.session.play();
    t.at(0.2);
    expect(t.session.getState().feedback?.value).toEqual({ kind: 'missed' });
    t.at(3.5);
    expect(t.session.getState().summary).toMatchObject({ missed: 3, accuracy: 0, stars: 0 });
  });

  it('ignores keys played during the count-in', () => {
    const t = setup(melody);
    t.session.play();
    t.at(-2);
    t.press(D4);
    expect(t.session.getState().marks.size).toBe(0);
    expect(t.session.getState().feedback).toBeNull();
  });

  it('ignores keys while paused or before starting', () => {
    const t = setup(melody);
    t.press(C4);
    t.session.play();
    t.at(-0.5);
    t.session.pause();
    t.press(C4);
    expect(t.session.getState().feedback).toBeNull();
    expect(t.session.getState().status).toBe('paused');
  });

  it('starts over from the count-in', () => {
    const t = setup(melody);
    t.session.play();
    t.at(1);
    t.session.restart();
    expect(t.session.getState()).toMatchObject({ status: 'ready', streak: 0, feedback: null });
    expect(t.transport.position()).toBe(-4);
  });

  it('grades only the selected hand and ignores the other hand’s keys', () => {
    const t = setup(
      [
        ['C3', 0, 2, 'L'],
        ['C4', 0],
        ['D4', 1],
      ],
      { hands: 'R' },
    );
    expect(t.session.graded.map((n) => n.pitch.midi)).toEqual([C4, D4]);
    t.session.play();
    t.at(0);
    t.press(C3); // left-hand note: neither right nor wrong
    t.press(C4);
    t.at(1);
    t.press(D4);
    t.at(2);
    expect(t.session.getState().summary).toMatchObject({ expected: 2, perfect: 2, wrong: 0 });
  });
});

describe('PracticeSession: wait mode', () => {
  it('has no count-in and starts at the lead-in', () => {
    const t = setup(melody, { mode: 'wait', leadIn: 2 });
    expect(t.session.countInFrom).toBeNull();
    expect(t.transport.position()).toBe(-2);
  });

  it('stops at each note until it is played', () => {
    const t = setup(melody, { mode: 'wait' });
    t.session.play();
    t.at(0.03);
    expect(t.session.getState().status).toBe('waiting');
    expect(t.transport.position()).toBe(0);
    expect(t.transport.playing).toBe(false);

    t.wait(5000); // take your time
    expect(t.transport.position()).toBe(0);

    t.press(D4); // wrong
    expect(t.session.getState().status).toBe('waiting');
    t.press(C4);
    expect(t.session.getState().status).toBe('playing');
    expect(t.transport.playing).toBe(true);
  });

  it('waits for every key of a chord', () => {
    const t = setup(
      [
        ['C3', 0, 1, 'L'],
        ['E4', 0],
      ],
      { mode: 'wait' },
    );
    t.session.play();
    t.at(0);
    t.press(E4);
    expect(t.session.getState().status).toBe('waiting');
    t.wait(1000);
    t.press(C3); // E4 is still held, so this completes the chord
    expect(t.session.getState().status).toBe('playing');
  });

  it('scores correct notes minus wrong keys', () => {
    const t = setup(melody, { mode: 'wait' });
    t.session.play();
    for (const [beat, pitches] of [
      [0, [C4]],
      [1, [E4, D4]], // one wrong key first
      [2, [E4]],
    ] as const) {
      t.at(beat);
      for (const pitch of pitches) {
        t.press(pitch);
        t.release(pitch);
      }
    }
    t.at(3);
    expect(t.session.getState().summary).toMatchObject({
      expected: 3,
      correct: 3,
      wrong: 1,
      stars: 2,
    });
    expect(t.session.getState().summary?.accuracy).toBeCloseTo(2.75 / 3);
  });

  it('accepts a note played before the music reaches it', () => {
    const t = setup(melody, { mode: 'wait' });
    t.session.play();
    t.at(-0.5);
    t.press(C4);
    t.at(0.5);
    expect(t.session.getState().status).toBe('playing');
    expect(t.session.outcomeOf(t.score.notes[0]!)).toEqual({ kind: 'correct' });
  });
});
