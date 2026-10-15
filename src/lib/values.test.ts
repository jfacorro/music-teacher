import { describe, expect, it } from 'vitest';
import { describeValues, isValueOf, valuesOf } from './values';

const Color = { Red: 'red', Green: 'green', Blue: 'blue' } as const;

describe('constant objects', () => {
  it('lists the values in order', () => {
    expect(valuesOf(Color)).toEqual(['red', 'green', 'blue']);
  });

  it('checks values read from data', () => {
    expect(isValueOf(Color, 'green')).toBe(true);
    expect(isValueOf(Color, 'Green')).toBe(false);
    expect(isValueOf(Color, 1)).toBe(false);
    expect(isValueOf(Color, undefined)).toBe(false);
  });

  it('describes the values for an error message', () => {
    expect(describeValues(Color)).toBe('"red", "green" or "blue"');
    expect(describeValues({ A: 'a', B: 'b' })).toBe('"a" or "b"');
    expect(describeValues({ A: 'a' })).toBe('"a"');
  });
});
