import { describe, expect, it } from 'vitest';
import { toggleBars } from './barSelection';

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
