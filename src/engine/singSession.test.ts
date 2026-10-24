import { describe, expect, it } from 'vitest';
import { SING_CENTS, SingMode } from './singing';
import { SingSession, SingStatus, type SingSessionOptions } from './singSession';
import { scoreOf, type NoteSpec } from './testUtils';
import { Transport } from './transport';

/** 60 BPM: one beat per second, so positions read as seconds. */
function setup(specs: NoteSpec[], options: Partial<SingSessionOptions> = {}) {
  const score = scoreOf(specs, 60);
  let now = 0;
  const transport = new Transport(score.tempo, () => now);
  const session = new SingSession(score, transport, {
    mode: SingMode.Along,
    leadInSeconds: 1,
    cents: SING_CENTS,
    octave: false,
    ...options,
  });
  return {
    session,
    transport,
    /** Sings `pitch` (or nothing) for `ms`, a reading every 40 ms, ticking along. */
    sing(pitch: number | null, ms: number) {
      for (let t = 0; t < ms; t += 40) {
        now += 40;
        session.reading(pitch, now);
        session.tick();
      }
    },
    /** Moves the clock to `beat` (assuming uninterrupted playback) and ticks. */
    at(beat: number) {
      now += (beat - transport.position()) * 1000;
      session.tick();
    },
  };
}

const melody: NoteSpec[] = [
  ['C4', 0],
  ['D4', 1],
  ['E4', 2],
];

describe('SingSession', () => {
  it('sings along after a measure counted in, and sums up', () => {
    const run = setup(melody);
    expect(run.session.countInFrom).toBe(-4);
    run.session.play();
    run.at(-3.5);
    expect(run.session.getState().countIn).toBe(1);
    run.at(0);
    run.sing(60, 1000);
    run.sing(62, 1000);
    run.sing(64.1, 1000);
    run.sing(null, 400);
    const { status, summary } = run.session.getState();
    expect(status).toBe(SingStatus.Finished);
    expect(summary?.stars).toBe(3);
    expect(summary?.onTime).toBe(1);
  });

  it('shows how the voice is doing against the note to sing', () => {
    const run = setup(melody);
    run.session.play();
    run.at(0.2);
    run.sing(59.8, 80);
    expect(run.session.getState().voice).toMatchObject({ target: 60, cents: -20, inTune: true });
    run.sing(null, 40);
    expect(run.session.getState().voice).toBeNull();
  });

  it('colors each note once it is over', () => {
    const run = setup(melody);
    run.session.play();
    run.at(0);
    run.sing(61, 1300);
    expect(run.session.resultOf(run.session.notes[0]!)?.inTune).toBe(0);
    expect(run.session.resultOf(run.session.notes[1]!)).toBeUndefined();
  });

  it('waits at each note until it is held in tune', () => {
    const run = setup(melody, { mode: SingMode.Wait });
    expect(run.session.countInFrom).toBeNull();
    run.session.play();
    run.at(0);
    expect(run.session.getState().status).toBe(SingStatus.Waiting);
    expect(run.session.waitingFor?.pitch.midi).toBe(60);
    run.session.listenFrom(0);
    run.sing(48, 400); // an octave lower counts
    expect(run.session.getState().status).toBe(SingStatus.Playing);
    run.at(1);
    expect(run.session.waitingFor?.pitch.midi).toBe(62);
    run.session.skip();
    run.at(2);
    run.sing(64, 400);
    run.at(3);
    const { summary } = run.session.getState();
    expect(summary?.notes.map((note) => note.credit)).toEqual([1, 0, 1]);
    expect(summary?.onTime).toBeNull();
  });

  it('plays the melody first, then counts in to sing it', () => {
    const run = setup(melody, { mode: SingMode.ListenFirst });
    expect(run.session.countInFrom).toBeNull();
    run.session.play();
    expect(run.session.appPlays).toBe(true);
    run.sing(60, 1000); // the app's sound isn't graded
    run.at(3);
    expect(run.session.getState().status).toBe(SingStatus.Playing);
    expect(run.session.countInFrom).toBe(-4);
    expect(run.transport.position()).toBeLessThan(-4);
    run.at(0);
    run.sing(60, 1000);
    run.sing(null, 2400);
    expect(run.session.getState().summary?.notes.map((note) => note.inTune)).toEqual([1, 0, 0]);
  });
});
