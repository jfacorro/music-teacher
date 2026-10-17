import { describe, expect, it } from 'vitest';
import { bestRun, stepKey } from './stepRuns';

describe('step history', () => {
  it('keys a lesson step like its recording', () => {
    expect(stepKey('u3-l5', 2)).toBe('lesson:u3-l5:2');
  });

  it('takes the most stars as best, then the best accuracy, then the latest', () => {
    const run = (at: number, stars: number, accuracy: number) => ({ at, stars, accuracy });
    expect(bestRun([])).toBeNull();
    expect(bestRun([run(1, 2, 0.9), run(2, 3, 0.85), run(3, 2, 0.99)])).toEqual(run(2, 3, 0.85));
    expect(bestRun([run(1, 3, 0.95), run(2, 3, 0.97), run(3, 3, 0.96)])).toEqual(run(2, 3, 0.97));
    expect(bestRun([run(1, 3, 0.95), run(2, 3, 0.95)])).toEqual(run(2, 3, 0.95));
  });
});
