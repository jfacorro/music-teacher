import { describe, expect, it } from 'vitest';
import type { Score } from './score';
import { FERMATA_HOLD, RIT_SLOWEST, TempoMap, tempoMapOf } from './tempoMap';
import { scoreOf } from './testUtils';
import { Transport } from './transport';

/** 60 BPM: a beat is a second. Four quarter notes, the third with a fermata. */
function score(extra: Partial<Score> = {}): Score {
  const base = scoreOf(
    [
      ['C4', 0],
      ['D4', 1],
      ['E4', 2],
      ['F4', 3],
    ],
    60,
  );
  return {
    ...base,
    notes: base.notes.map((note, i) => (i === 2 ? { ...note, fermata: true } : note)),
    ...extra,
  };
}

describe('TempoMap', () => {
  it('holds a fermata twice as long', () => {
    const map = tempoMapOf(score());
    expect(map.msBetween(0, 2, 60)).toBe(2000);
    expect(map.msBetween(2, 3, 60)).toBe(1000 * FERMATA_HOLD);
    expect(map.msBetween(0, 4, 60)).toBe(5000);
    expect(map.msBetween(4, 0, 60)).toBe(-5000);
  });

  it('turns time back into beats, also backwards', () => {
    const map = tempoMapOf(score());
    expect(map.beatAfter(0, 2000, 60)).toBe(2);
    expect(map.beatAfter(0, 3000, 60)).toBe(2.5);
    expect(map.beatAfter(0, 5000, 60)).toBe(4);
    expect(map.beatAfter(4, -5000, 60)).toBe(4 - 4);
    expect(map.beatAfter(3, -1000, 60)).toBe(2.5);
  });

  it('slows down gradually through a ritardando, and is back in tempo after', () => {
    const noFermata = score().notes.map((note) => ({ ...note, fermata: false }));
    const plain = tempoMapOf({ ...score(), notes: noFermata });
    expect(plain).toBe(TempoMap.NONE);
    const map = tempoMapOf({ ...score(), notes: noFermata, ritardandos: [{ start: 0, end: 4 }] });
    const first = map.msBetween(0, 1, 60);
    const last = map.msBetween(3, 4, 60);
    expect(first).toBeGreaterThan(1000);
    expect(last).toBeGreaterThan(first);
    expect(last).toBeLessThan(1000 / RIT_SLOWEST + 1);
    expect(map.msBetween(4, 5, 60)).toBe(1000);
  });
});

describe('Transport with a tempo map', () => {
  it('waits on a fermata, and schedules ahead with it', () => {
    let now = 0;
    const transport = new Transport(60, () => now);
    transport.setTempoMap(tempoMapOf(score()));
    transport.play();
    now = 2000;
    expect(transport.position()).toBe(2);
    now = 3000;
    expect(transport.position()).toBe(2.5);
    expect(transport.timeAt(4)).toBe(5000);
    now = 5000;
    expect(transport.position()).toBe(4);
  });
});
