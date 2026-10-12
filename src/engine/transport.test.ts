import { describe, expect, it, vi } from 'vitest';
import { Transport } from './transport';

function setup(tempo = 120) {
  let now = 1000;
  const transport = new Transport(tempo, () => now);
  return { transport, advance: (ms: number) => (now += ms) };
}

describe('Transport', () => {
  it('stays put while paused', () => {
    const { transport, advance } = setup();
    advance(5000);
    expect(transport.position()).toBe(0);
  });

  it('advances with the clock at the tempo while playing', () => {
    const { transport, advance } = setup(120); // 2 beats per second
    transport.play();
    advance(1500);
    expect(transport.position()).toBe(3);
  });

  it('keeps the position when paused and resumes from it', () => {
    const { transport, advance } = setup(60);
    transport.play();
    advance(2000);
    transport.pause();
    advance(10_000);
    expect(transport.position()).toBe(2);
    transport.play();
    advance(1000);
    expect(transport.position()).toBe(3);
  });

  it('seeks while playing or paused, including before the start', () => {
    const { transport, advance } = setup(60);
    transport.seek(-2);
    expect(transport.position()).toBe(-2);
    transport.play();
    advance(1000);
    transport.seek(10);
    advance(1000);
    expect(transport.position()).toBe(11);
  });

  it('changes tempo without jumping', () => {
    const { transport, advance } = setup(60);
    transport.play();
    advance(2000); // 2 beats
    transport.setTempo(120);
    expect(transport.position()).toBe(2);
    advance(1000); // +2 beats at 120
    expect(transport.position()).toBe(4);
  });

  it('notifies subscribers with a new state snapshot', () => {
    const { transport } = setup();
    const listener = vi.fn();
    const unsubscribe = transport.subscribe(listener);
    const before = transport.getState();
    transport.play();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(transport.getState()).not.toBe(before);
    expect(transport.getState()).toEqual({ playing: true, tempo: 120 });
    transport.play(); // already playing: no change
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    transport.pause();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
