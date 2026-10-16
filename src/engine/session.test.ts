import { describe, expect, it } from 'vitest';
import {
  PracticeSession,
  type SessionOptions,
  PracticeMode,
  HandFilter,
  FeedbackKind,
} from './session';
import { noteOff, noteOn, scoreOf, type NoteSpec } from './testUtils';
import { Transport } from './transport';
import { InputSource } from '../input/types';
import { Hand } from './score';

const C3 = 48;
const C4 = 60;
const D4 = 62;
const E4 = 64;
const G4 = 67;

/** 60 BPM: one beat per second, so positions read as seconds. */
function setup(specs: NoteSpec[], options: Partial<SessionOptions> = {}) {
  const score = scoreOf(specs, 60);
  let now = 0;
  const transport = new Transport(score.tempo, () => now);
  const session = new PracticeSession(score, transport, {
    mode: PracticeMode.Tempo,
    hands: HandFilter.Both,
    leadInSeconds: 2,
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
    expect(setup(melody, { leadInSeconds: 2 }).transport.position()).toBe(-4);
    expect(setup(melody, { leadInSeconds: 6 }).transport.position()).toBe(-6);
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
    expect(summary?.timing).toMatchObject({ early: 0, onTime: 3, late: 0 });
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
    expect(t.session.getState().feedback?.value).toMatchObject({ kind: 'wrong' });
    t.release(E4);
    expect(t.session.getState().marks.has(E4)).toBe(false);
  });

  it('names the expected notes when a wrong key is played', () => {
    const t = setup(melody);
    t.session.play();
    t.at(0.95);
    t.press(C4); // D4 is due
    const feedback = t.session.getState().feedback?.value;
    expect(feedback?.kind).toBe('wrong');
    expect(feedback?.kind === FeedbackKind.Wrong && feedback.expected.map((p) => p.midi)).toEqual([
      D4,
    ]);
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
        ['C3', 0, 2, Hand.Left],
        ['C4', 0],
        ['D4', 1],
      ],
      { hands: HandFilter.Right },
    );
    expect(t.session.practiced.map((n) => n.pitch.midi)).toEqual([C4, D4]);
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

describe('PracticeSession: microphone notes near expected ones', () => {
  const micOn = (pitch: number, time: number) => noteOn(pitch, time, InputSource.Mic);
  const micOff = (pitch: number, time: number) => noteOff(pitch, time, InputSource.Mic);

  it('counts an octave error as the expected note in tempo mode', () => {
    const t = setup(melody, { defaultSource: InputSource.Mic });
    t.session.play();
    t.at(0);
    t.session.handleNote(micOn(C4 + 12, t.now));
    expect(t.session.getState().feedback?.value).toMatchObject({ kind: 'hit', grade: 'perfect' });
    expect(t.session.getState().marks).toEqual(new Map([[C4, 'correct']]));
    expect(t.session.displayPitch(C4 + 12)).toBe(C4);
    t.session.handleNote(micOff(C4 + 12, t.now));
    expect(t.session.getState().marks.size).toBe(0);
    expect(t.session.displayPitch(C4 + 12)).toBe(C4 + 12);
  });

  it('counts the third harmonic (an octave and a fifth up) in wait mode', () => {
    const t = setup(melody, { mode: PracticeMode.Wait });
    t.session.play();
    t.at(0);
    t.session.handleNote(micOn(C4 + 19, t.now));
    expect(t.session.getState().status).toBe('playing');
    expect(t.session.outcomeOf(t.score.notes[0]!)).toEqual({ kind: 'correct' });
  });

  it('still marks unrelated microphone notes as wrong', () => {
    const t = setup(melody, { mode: PracticeMode.Wait });
    t.session.play();
    t.at(0);
    t.session.handleNote(micOn(C4 + 7, t.now));
    expect(t.session.getState().feedback?.value).toMatchObject({ kind: 'wrong' });
    expect(t.session.getState().status).toBe('waiting');
  });

  it('is strict with MIDI, which never confuses octaves', () => {
    const t = setup(melody);
    t.session.play();
    t.at(0);
    t.press(C4 + 12);
    expect(t.session.getState().feedback?.value).toMatchObject({ kind: 'wrong' });
  });
});

describe('PracticeSession: wait mode', () => {
  it('has no count-in and starts at the lead-in', () => {
    const t = setup(melody, { mode: PracticeMode.Wait, leadInSeconds: 2 });
    expect(t.session.countInFrom).toBeNull();
    expect(t.transport.position()).toBe(-2);
  });

  it('stops at each note until it is played', () => {
    const t = setup(melody, { mode: PracticeMode.Wait });
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
        ['C3', 0, 1, Hand.Left],
        ['E4', 0],
      ],
      { mode: PracticeMode.Wait },
    );
    t.session.play();
    t.at(0);
    t.press(E4);
    expect(t.session.getState().status).toBe('waiting');
    t.wait(1000);
    t.press(C3); // E4 is still held, so this completes the chord
    expect(t.session.getState().status).toBe('playing');
  });

  it('names the notes it waits for when a wrong key is played', () => {
    const t = setup(
      [
        ['C3', 0, 1, Hand.Left],
        ['E4', 0],
      ],
      { mode: PracticeMode.Wait },
    );
    t.session.play();
    t.at(0);
    t.press(D4);
    const feedback = t.session.getState().feedback?.value;
    expect(feedback?.kind === FeedbackKind.Wrong && feedback.expected.map((p) => p.midi)).toEqual([
      C3,
      E4,
    ]);
  });

  it('scores correct notes minus wrong keys', () => {
    const t = setup(melody, { mode: PracticeMode.Wait });
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
    const t = setup(melody, { mode: PracticeMode.Wait });
    t.session.play();
    t.at(-0.5);
    t.press(C4);
    t.at(0.5);
    expect(t.session.getState().status).toBe('playing');
    expect(t.session.outcomeOf(t.score.notes[0]!)).toEqual({ kind: 'correct' });
  });
});

describe('PracticeSession: chords with the microphone', () => {
  const chord: NoteSpec[] = [
    ['C4', 0],
    ['E4', 0],
    ['G4', 0],
    ['D4', 1],
  ];
  const micPress = (t: ReturnType<typeof setup>, pitch: number) =>
    t.session.handleNote(noteOn(pitch, t.now, InputSource.Mic));

  it('counts any note of a chord for the whole chord in tempo mode', () => {
    const t = setup(chord);
    t.session.play();
    t.at(0.02);
    micPress(t, E4);
    for (const note of t.score.notes.slice(0, 3)) {
      expect(t.session.outcomeOf(note)).toMatchObject({ kind: 'hit', grade: 'perfect' });
    }
    t.at(3);
    expect(t.session.getState().summary).toMatchObject({ expected: 4, perfect: 3, missed: 1 });
  });

  it('moves on after any note of a chord in wait mode', () => {
    const t = setup(chord, { mode: PracticeMode.Wait });
    t.session.play();
    t.at(0);
    micPress(t, G4);
    expect(t.session.getState().status).toBe('playing');
    expect(t.score.notes.slice(0, 3).map((note) => t.session.outcomeOf(note)?.kind)).toEqual([
      'correct',
      'correct',
      'correct',
    ]);
  });

  it('still wants every note of a chord from a MIDI keyboard', () => {
    const t = setup(chord, { mode: PracticeMode.Wait });
    t.session.play();
    t.at(0);
    t.press(G4);
    expect(t.session.getState().status).toBe('waiting');
  });
});

describe('PracticeSession: any key (rhythm)', () => {
  const rhythm: NoteSpec[] = [
    ['E4', 0],
    ['E4', 1],
    ['E4', 2, 2],
  ];

  it('takes any key as the next note and grades only the timing', () => {
    const t = setup(rhythm, { anyKey: true });
    t.session.play();
    for (const [beat, pitch] of [
      [0, C4],
      [1.02, D4],
      [1.96, 90],
    ] as const) {
      t.at(beat);
      t.press(pitch);
      t.release(pitch);
    }
    t.at(4);
    expect(t.session.getState().summary).toMatchObject({ expected: 3, perfect: 3, wrong: 0 });
  });

  it('calls a tap when nothing is due an extra tap', () => {
    const t = setup(rhythm, { anyKey: true });
    t.session.play();
    t.at(0.5);
    t.press(C4);
    expect(t.session.getState().feedback?.value).toEqual({ kind: 'extra' });
  });
});

describe('PracticeSession: loop and tempo', () => {
  /** One note per measure: C4 in the first, D4 in the second, E4 in the third. */
  const bars: NoteSpec[] = [
    ['C4', 0],
    ['D4', 4],
    ['E4', 8],
  ];

  it('practices only the loop, counting in during the measure before it', () => {
    const t = setup(bars, { loop: { first: 1, last: 1 } });
    expect(t.session.practiced.map((n) => n.pitch.midi)).toEqual([D4]);
    expect(t.session.isGraded(t.score.notes[0]!)).toBe(false);
    expect(t.session.countInFrom).toBe(0);
    expect(t.transport.position()).toBe(0);
    t.session.play();
    t.at(1);
    expect(t.session.getState().countIn).toBe(2);
    t.at(4);
    expect(t.session.getState().countIn).toBeNull();
  });

  it('jumps back at the end of the loop, keeping the beat and scoring each time through', () => {
    const t = setup(bars, { loop: { first: 1, last: 1 } });
    const d4 = t.score.notes[1]!;
    t.session.play();
    t.at(4);
    t.press(D4);
    t.release(D4);
    t.at(8.01);
    expect(t.transport.position()).toBeCloseTo(4.01);
    expect(t.session.getState()).toMatchObject({
      status: 'playing',
      lastPass: { count: 1, accuracy: 1 },
      summary: null,
    });
    expect(t.session.outcomeOf(d4)).toBeUndefined(); // a fresh start

    t.at(8.5); // D4 not played this time
    expect(t.session.getState().lastPass).toEqual({ count: 2, accuracy: 0 });
    expect(t.transport.position()).toBeCloseTo(4.5);
  });

  it('loops in wait mode once the last notes are played', () => {
    const t = setup(bars, { mode: PracticeMode.Wait, loop: { first: 0, last: 1 } });
    t.session.play();
    t.at(0);
    t.press(C4);
    t.at(4);
    expect(t.session.getState().status).toBe('waiting');
    t.press(D4);
    t.at(8);
    expect(t.session.getState().lastPass).toEqual({ count: 1, accuracy: 1 });
    t.at(0.01);
    expect(t.session.getState().status).toBe('waiting');
    expect(t.transport.position()).toBe(0);
  });

  it('doesn’t count keys of the notes just before the loop as wrong', () => {
    const t = setup(
      [
        ['C4', 0, 4],
        ['D4', 4],
      ],
      { mode: PracticeMode.Wait, loop: { first: 1, last: 1 } },
    );
    t.session.play();
    t.at(2.5);
    t.press(C4);
    expect(t.session.getState().feedback).toBeNull();
    t.press(E4);
    expect(t.session.getState().feedback?.value.kind).toBe('wrong');
  });

  it('turns the loop off and starts over', () => {
    const t = setup(bars, { loop: { first: 1, last: 1 } });
    t.session.play();
    t.at(5);
    t.session.setLoop(null);
    expect(t.session.practiced).toHaveLength(3);
    expect(t.session.getState().status).toBe('ready');
    expect(t.transport.position()).toBe(-4);
  });

  it('changes tempo without jumping, and moves to the new lead-in before starting', () => {
    const t = setup(melody, { mode: PracticeMode.Wait, leadInSeconds: 2 });
    t.session.setTempo(30);
    expect(t.transport.position()).toBe(-1); // 2 s at 30 BPM
    t.session.play();
    t.wait(1000);
    expect(t.transport.position()).toBeCloseTo(-0.5);
    t.session.setTempo(60);
    expect(t.transport.position()).toBeCloseTo(-0.5);
  });
});

describe('PracticeSession: autoplay', () => {
  it('plays through without counting in, grading or results', () => {
    const t = setup(melody, { mode: PracticeMode.Autoplay });
    expect(t.session.countInFrom).toBeNull();
    t.session.play();
    t.at(0.5);
    t.press(G4); // the learner playing along changes nothing
    t.release(G4);
    expect(t.session.getState()).toMatchObject({ status: 'playing', feedback: null, streak: 0 });
    expect(t.session.getState().marks.size).toBe(0);
    t.at(2.5);
    expect(t.session.outcomeOf(t.score.notes[0]!)).toBeUndefined();
    t.at(3.01);
    expect(t.session.getState()).toMatchObject({ status: 'finished', summary: null });
  });

  it('repeats the loop without scoring it', () => {
    const t = setup(melody, { mode: PracticeMode.Autoplay, loop: { first: 0, last: 0 } });
    t.session.play();
    t.at(4.25);
    expect(t.transport.position()).toBeCloseTo(0.25);
    expect(t.session.getState()).toMatchObject({ status: 'playing', lastPass: null });
  });

  it('starts again after finishing', () => {
    const t = setup(melody, { mode: PracticeMode.Autoplay });
    t.session.play();
    t.at(3.01);
    t.session.play();
    expect(t.session.getState().status).toBe('playing');
    expect(t.transport.position()).toBeLessThan(0);
  });
});

describe('PracticeSession: dynamics', () => {
  const soft: NoteSpec[] = [
    ['C4', 0],
    ['D4', 1],
  ];
  const withDynamics = (specs: NoteSpec[], options: Partial<SessionOptions> = {}) => {
    const t = setup(specs, options);
    t.score.dynamics = { marks: [{ beat: 0, dynamic: 'p' }], hairpins: [] };
    return t;
  };

  it('grades how hard the notes were played on a MIDI keyboard', () => {
    const t = withDynamics(soft, { mode: PracticeMode.Wait });
    t.session.play();
    for (const pitch of [C4, D4]) {
      t.at(t.score.notes.find((n) => n.pitch.midi === pitch)!.start);
      t.session.handleNote({ ...noteOn(pitch, t.now), velocity: 100 });
      t.release(pitch);
    }
    t.at(2.01);
    expect(t.session.getState().summary?.dynamics).toMatchObject({
      passages: [{ dynamic: 'p', velocity: 100, ok: false }],
      ok: false,
    });
  });

  it('has no dynamics to report through the microphone', () => {
    const t = withDynamics(soft, { mode: PracticeMode.Wait });
    t.session.play();
    for (const pitch of [C4, D4]) {
      t.at(t.score.notes.find((n) => n.pitch.midi === pitch)!.start);
      t.session.handleNote(noteOn(pitch, t.now, InputSource.Mic));
      t.session.handleNote(noteOff(pitch, t.now + 100, InputSource.Mic));
    }
    t.at(2.01);
    expect(t.session.getState().summary?.dynamics).toBeNull();
  });
});

describe('PracticeSession: wrong keys of each hand', () => {
  it('puts a wrong key down to the hand playing the nearest note', () => {
    const t = setup(
      [
        ['C4', 0],
        ['C3', 0, 1, Hand.Left],
      ],
      { mode: PracticeMode.Wait },
    );
    t.session.play();
    t.at(0);
    t.press(50); // D3, a key off the left hand's C3
    t.release(50);
    t.press(C3);
    t.press(C4);
    t.release(C3);
    t.release(C4);
    t.at(1.01);
    const hands = t.session.getState().summary?.hands;
    expect(hands?.map(({ hand, tally }) => [hand, tally.wrong, tally.accuracy])).toEqual([
      [Hand.Right, 0, 1],
      [Hand.Left, 1, 0.75],
    ]);
  });
});
