import { describe, expect, it } from 'vitest';
import { pitchOf, type NoteString } from '../theory/pitch';
import { beatsToMs, Hand, type ScoreNote } from './score';
import {
  centsOff,
  SING_CENTS,
  SING_CENTS_STRICT,
  singSummary,
  SungTake,
  tuneLevel,
  TuneLevel,
  WAIT_HOLD_MS,
  WaitSinger,
} from './singing';
import { MATCH_WITHIN_MS } from './matchNote';

const TEMPO = 60; // a beat a second
const note = (name: NoteString, start: number, duration = 1): ScoreNote => ({
  pitch: pitchOf(name),
  start,
  duration,
  hand: Hand.Right,
});
const options = { cents: SING_CENTS, octave: false };
/** Readings every 40 ms (about the microphone's rate). */
const STEP_MS = 40;

/** Sings `pitch(beat)` from beat `from` to `to` (null: silence). */
function sing(take: SungTake, from: number, to: number, pitch: (beat: number) => number | null) {
  for (let ms = beatsToMs(from, TEMPO); ms < beatsToMs(to, TEMPO); ms += STEP_MS) {
    const beat = (ms * TEMPO) / 60_000;
    take.add({ time: ms, beat, pitch: pitch(beat) });
  }
}

describe('centsOff', () => {
  it('counts any octave, or only the written one', () => {
    expect(centsOff(60, 72.1, false)).toBe(10);
    expect(centsOff(60, 72.1, true)).toBe(1210);
    expect(centsOff(60, 59.7, true)).toBe(-30);
  });
});

describe('SungTake', () => {
  const melody = [note('C4', 0), note('D4', 1), note('E4', 2)];

  it('grades notes sung in tune and on time in full', () => {
    const take = new SungTake(melody, TEMPO, options);
    sing(take, 0, 3, (beat) => [60, 62, 64][Math.floor(beat)]! + 0.05);
    const results = take.results();
    expect(results.map((r) => r.inTune)).toEqual([1, 1, 1]);
    expect(results.every((r) => r.onTime && r.credit === 1)).toBe(true);
    expect(results[0]!.offset).toBe(5);
    expect(results[0]!.steady).toBe(1);
    const summary = singSummary(results);
    expect(summary.stars).toBe(3);
    expect(summary.onTime).toBe(1);
    expect(summary.toWorkOn).toEqual([]);
  });

  it('counts an octave lower, unless the written octave is asked for', () => {
    const low = (take: SungTake) => sing(take, 0, 1, () => 48);
    const anyOctave = new SungTake([note('C4', 0)], TEMPO, options);
    low(anyOctave);
    expect(anyOctave.result(0).inTune).toBe(1);
    const written = new SungTake([note('C4', 0)], TEMPO, { ...options, octave: true });
    low(written);
    expect(written.result(0).inTune).toBe(0);
  });

  it('is stricter at ±25 cents', () => {
    const take = new SungTake([note('C4', 0)], TEMPO, { cents: SING_CENTS_STRICT, octave: false });
    sing(take, 0, 1, () => 60.35);
    expect(take.result(0).inTune).toBe(0);
    expect(take.result(0).offset).toBe(35);
  });

  it('says a late note started late, and counts it less', () => {
    const take = new SungTake([note('C4', 0, 2)], TEMPO, options);
    sing(take, 0, 0.5, () => null);
    sing(take, 0.5, 2, () => 60);
    const result = take.result(0);
    expect(result.onTime).toBe(false);
    expect(result.startMs).toBeGreaterThanOrEqual(480);
    expect(result.credit).toBeLessThan(1);
  });

  it('counts a note started a little early as on time', () => {
    const take = new SungTake([note('C4', 1)], TEMPO, options);
    sing(take, 0.85, 2, () => 60);
    expect(take.result(0).startMs).toBeLessThan(0);
    expect(take.result(0).onTime).toBe(true);
  });

  it("doesn't count the note before, on the same pitch, as starting this one early", () => {
    const take = new SungTake([note('C4', 0), note('C4', 1)], TEMPO, options);
    sing(take, 0, 2, () => 60);
    expect(take.result(1).startMs).toBe(0);
  });

  it('grades a note never sung as missed, and names it to work on', () => {
    const take = new SungTake(melody, TEMPO, options);
    sing(take, 0, 2, (beat) => [60, 62][Math.floor(beat)]!);
    sing(take, 2, 3, () => 63.3); // E4 sung 70 cents flat
    const results = take.results();
    expect(results[2]).toMatchObject({ inTune: 0, startMs: null, credit: 0, offset: -70 });
    const summary = singSummary(results);
    expect(summary.toWorkOn).toEqual([{ midi: 64, inTune: 0, offset: -70 }]);
    expect(summary.stars).toBe(1); // two notes of three
  });

  it("doesn't count vibrato as unsteady, but does a wandering voice", () => {
    const vibrato = new SungTake([note('C4', 0, 2)], TEMPO, options);
    // ±40 cents at about 6 Hz.
    sing(vibrato, 0, 2, (beat) => 60 + 0.4 * Math.sin(2 * Math.PI * 6 * beat));
    expect(vibrato.result(0).steady).toBeGreaterThan(0.9);
    const wandering = new SungTake([note('C4', 0, 2)], TEMPO, options);
    sing(wandering, 0, 2, (beat) => 59.5 + 0.5 * beat);
    expect(wandering.result(0).steady).toBeLessThan(0.5);
  });

  it('colors notes by how in tune they were', () => {
    const take = new SungTake([note('C4', 0, 2)], TEMPO, options);
    sing(take, 0, 1, () => 60);
    sing(take, 1, 2, () => 61);
    expect(tuneLevel(take.result(0))).toBe(TuneLevel.Partly);
  });
});

describe('WaitSinger', () => {
  it('finds a note held in tune long enough, and moves on', () => {
    const waiter = new WaitSinger([note('C4', 0), note('E4', 1)], options);
    waiter.listen(1000);
    expect(waiter.update(60, 900, 0).held).toBe(0); // the app is still playing it
    let found = false;
    for (let time = 1000; !found; time += STEP_MS) found = waiter.update(60, time, 0).found;
    expect(waiter.current?.pitch.midi).toBe(64);
    const [first] = waiter.results();
    expect(first).toMatchObject({ credit: 1, onTime: null, inTune: 1 });
    expect(first!.startMs).toBeGreaterThanOrEqual(WAIT_HOLD_MS);
  });

  it('starts the hold over when the voice goes out of tune', () => {
    const waiter = new WaitSinger([note('C4', 0)], options);
    waiter.listen(0);
    waiter.update(60, 0, 0);
    waiter.update(60, 200, 0);
    expect(waiter.update(61, 240, 0).held).toBe(0);
    expect(waiter.update(60, 280, 0).held).toBe(0);
    expect(waiter.update(60, 280 + WAIT_HOLD_MS, 0).found).toBe(true);
  });

  it('counts a slow find less, and a skipped note not at all', () => {
    const waiter = new WaitSinger([note('C4', 0), note('D4', 1)], options);
    waiter.listen(0);
    const late = MATCH_WITHIN_MS + 1000;
    waiter.update(60, late, 0);
    waiter.update(60, late + WAIT_HOLD_MS, 0);
    waiter.skip();
    expect(waiter.finished).toBe(true);
    expect(waiter.results().map((r) => r.credit)).toEqual([0.5, 0]);
    expect(singSummary(waiter.results()).onTime).toBeNull();
  });
});
