import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Transport } from '../engine/transport';
import { startMetronome } from './metronome';

describe('startMetronome', () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
  });
  afterEach(() => vi.useRealTimers());

  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 5) {
      now += 5;
      vi.advanceTimersByTime(5);
    }
  };

  it('queues each click once, slightly ahead, at the right clock time', () => {
    const transport = new Transport(120, () => now); // a beat every 500 ms
    transport.seek(-2);
    const clicks: [number, boolean][] = [];
    const stop = startMetronome(
      transport,
      () => ({ metronome: true, countInFrom: -2, beatsPerMeasure: 2 }),
      (time, accent) => clicks.push([Math.round(time) + 0, accent]),
    );
    transport.play();
    run(1600); // up to beat ~1.2, plus look-ahead
    stop();
    expect(clicks).toEqual([
      [0, true], // count-in starts right away, on beat -2
      [500, false],
      [1000, true], // beat 0
      [1500, false],
    ]);
  });

  it('stays quiet while paused and resyncs after a seek', () => {
    const transport = new Transport(60, () => now);
    const clicks: number[] = [];
    const stop = startMetronome(
      transport,
      () => ({ metronome: true, countInFrom: null, beatsPerMeasure: 4 }),
      (time) => clicks.push(Math.round(time)),
    );
    run(3000);
    expect(clicks).toEqual([]);
    transport.seek(10);
    transport.play();
    run(1100);
    stop();
    expect(clicks).toEqual([3000, 4000]); // beats 10 and 11
  });
});
