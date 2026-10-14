import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scoreOf } from '../engine/testUtils';
import { Transport } from '../engine/transport';
import { startAccompaniment, type AccompanimentOptions } from './accompaniment';

describe('startAccompaniment', () => {
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

  /** Left-hand notes on beats 0–3 at 60 BPM (one beat per second). */
  const { notes } = scoreOf([
    ['C3', 0, 1, 'L'],
    ['E3', 1, 1, 'L'],
    ['G3', 2, 1, 'L'],
    ['C3', 3, 1, 'L'],
  ]);

  function start(options: Partial<AccompanimentOptions> = {}) {
    const transport = new Transport(60, () => now);
    const played: string[] = [];
    const settings = { enabled: true, notes, from: 0, until: Infinity, ...options };
    const stop = startAccompaniment(
      transport,
      () => settings,
      (note, start, end) =>
        played.push(`${note.pitch.midi}@${Math.round(start)}-${Math.round(end)}`),
    );
    return { transport, played, settings, stop };
  }

  it('plays each note once, on time, for its length', () => {
    const { transport, played, stop } = start();
    transport.play();
    run(2000);
    stop();
    expect(played).toEqual(['48@0-1000', '52@1000-2000', '55@2000-3000']);
  });

  it('holds back notes from where wait mode stops until the music moves on', () => {
    const { transport, played, settings, stop } = start({ until: 1 });
    transport.play();
    run(900);
    expect(played).toEqual(['48@0-1000']);
    // The music stops at beat 1 and waits; the learner plays the note at 3000 ms.
    transport.pause();
    transport.seek(1);
    run(2100);
    expect(played).toHaveLength(1);
    settings.until = 2;
    transport.play();
    run(30);
    stop();
    expect(played).toEqual(['48@0-1000', '52@3000-4000']);
  });

  it('plays only the practiced music, and nothing when turned off', () => {
    const loop = start({ from: 2 });
    loop.transport.play();
    run(3000);
    loop.stop();
    expect(loop.played.map((p) => p.split('@')[0])).toEqual(['55', '48']);

    const off = start({ enabled: false });
    off.transport.play();
    run(3000);
    off.stop();
    expect(off.played).toEqual([]);
  });
});
