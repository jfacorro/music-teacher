import { describe, expect, it } from 'vitest';
import { barsParam, parseBars, toggleBars } from './barSelection';

describe('toggleBars', () => {
  it('repeats the chosen bars', () => {
    expect(toggleBars(null, { first: 2, last: 3 })).toEqual({ first: 2, last: 3 });
    expect(toggleBars({ first: 0, last: 1 }, { first: 2, last: 2 })).toEqual({ first: 2, last: 2 });
  });

  it('stops repeating when the same bars are chosen again', () => {
    expect(toggleBars({ first: 2, last: 2 }, { first: 2, last: 2 })).toBeNull();
    expect(toggleBars({ first: 2, last: 4 }, { first: 2, last: 4 })).toBeNull();
  });

  it('stops repeating on a click inside the loop', () => {
    expect(toggleBars({ first: 2, last: 4 }, { first: 3, last: 3 })).toBeNull();
  });

  it('narrows the loop when dragging over part of it', () => {
    expect(toggleBars({ first: 2, last: 5 }, { first: 3, last: 4 })).toEqual({ first: 3, last: 4 });
  });

  it('moves or widens the loop when going outside it', () => {
    expect(toggleBars({ first: 2, last: 3 }, { first: 3, last: 5 })).toEqual({ first: 3, last: 5 });
  });
});

describe('bars in an address', () => {
  it('writes and reads them counted from 1', () => {
    expect(barsParam({ first: 4, last: 5 })).toBe('5-6');
    expect(barsParam({ first: 2, last: 2 })).toBe('3');
    expect(parseBars('5-6', 8)).toEqual({ first: 4, last: 5 });
    expect(parseBars('3', 8)).toEqual({ first: 2, last: 2 });
  });

  it('ignores bars the music doesn’t have, and anything else', () => {
    expect(parseBars('7-9', 8)).toBeNull();
    expect(parseBars('0', 8)).toBeNull();
    expect(parseBars('6-5', 8)).toBeNull();
    expect(parseBars('a', 8)).toBeNull();
    expect(parseBars(null, 8)).toBeNull();
  });
});
