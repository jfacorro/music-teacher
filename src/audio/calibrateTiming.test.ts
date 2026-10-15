import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitNote, setActiveSources } from '../input/bus';
import { noteOn } from '../engine/testUtils';
import { InputSource } from '../input/types';

const audio = vi.hoisted(() => ({ click: vi.fn(), noteOn: vi.fn(), noteOff: vi.fn() }));
vi.mock('./audio', () => ({ startAudio: () => Promise.resolve(audio) }));

const { measureClickTiming } = await import('./calibrateTiming');

describe('measureClickTiming', () => {
  afterEach(() => vi.useRealTimers());

  it('measures how late taps land after the clicks', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] });
    setActiveSources(() => true);
    const beats: [number, boolean][] = [];
    const pending = measureClickTiming({
      tempo: 60,
      countIn: 2,
      taps: 4,
      onBeat: (beat, countingIn) => beats.push([beat, countingIn]),
    });
    await vi.advanceTimersByTimeAsync(0);

    const clicks = audio.click.mock.calls.map(([time]) => time as number);
    expect(clicks).toHaveLength(6);
    // Taps 70 ms after each click after the count-in (± a little human wobble), one from
    // the microphone (ignored), and one stray tap far from any click (unpaired).
    clicks
      .slice(2)
      .forEach((time, i) => emitNote(noteOn(60, time + 70 + (i % 2 ? 5 : -5), InputSource.Midi)));
    emitNote(noteOn(60, clicks[3]! + 10, InputSource.Mic));
    emitNote(noteOn(60, clicks[5]! + 600, InputSource.Dev));

    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;
    expect(result).toEqual({ offsetMs: 70, jitterMs: 5, taps: 4 });
    expect(beats).toEqual([
      [1, true],
      [2, true],
      [3, false],
      [4, false],
      [5, false],
      [6, false],
    ]);
  });
});
