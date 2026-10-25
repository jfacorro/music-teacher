import { describe, expect, it } from 'vitest';
import { SingBack, type SingBackUpdate, WRONG_HOLD_MS } from './singBack';
import { WAIT_HOLD_MS } from './singing';

/** Readings every 40 ms (about the microphone's rate). */
const STEP_MS = 40;

/** Sings `pitch` from `from` for `ms`, returning every update that found or judged something. */
function sing(back: SingBack, pitch: number | null, from: number, ms: number): SingBackUpdate[] {
  const events = [];
  for (let time = from; time < from + ms; time += STEP_MS) {
    const update = back.update(pitch, time);
    if (update.found !== null || update.wrong !== null) events.push(update);
  }
  return events;
}

describe('SingBack', () => {
  it('finds each note once it is held in tune, in any octave', () => {
    const back = new SingBack([60, 64]);
    expect(sing(back, 60.2, 0, WAIT_HOLD_MS - STEP_MS)).toEqual([]);
    expect(sing(back, 60.2, WAIT_HOLD_MS - STEP_MS, 200)).toEqual([
      { held: 1, found: 0, wrong: null },
    ]);
    expect(back.sung).toBe(1);
    expect(sing(back, 52.1, 1000, 500)).toEqual([{ held: 1, found: 1, wrong: null }]);
    expect(back.finished).toBe(true);
  });

  it('says a wrong note once it is held, once until the voice moves on', () => {
    const back = new SingBack([60]);
    const events = sing(back, 62, 0, 2000);
    expect(events).toEqual([{ held: 0, found: null, wrong: 62 }]);
    expect(sing(back, 63, 2000, WRONG_HOLD_MS + 100)).toEqual([
      { held: 0, found: null, wrong: 63 },
    ]);
  });

  it('lets slides through, and the note just found held on', () => {
    const back = new SingBack([60, 67]);
    sing(back, 60, 0, 400);
    expect(back.sung).toBe(1);
    // Holding on to the first note, then sliding up through the notes between.
    expect(sing(back, 60, 400, 1000)).toEqual([]);
    for (let i = 0; i < 7; i++) expect(sing(back, 60 + i, 1400 + i * 200, 200)).toEqual([]);
    expect(sing(back, 67, 2800, 400)).toEqual([{ held: 1, found: 1, wrong: null }]);
  });

  it('breaks the hold when the voice goes out of tune', () => {
    const back = new SingBack([60]);
    sing(back, 60, 0, 200);
    sing(back, 60.7, 200, 120);
    expect(sing(back, 60, 320, 200)).toEqual([]);
    expect(back.sung).toBe(0);
  });

  it('skips a note', () => {
    const back = new SingBack([60, 62]);
    back.skip();
    expect(back.current).toBe(62);
    back.skip();
    expect(back.finished).toBe(true);
    expect(back.update(62, 0)).toEqual({ held: 0, found: null, wrong: null });
  });
});
