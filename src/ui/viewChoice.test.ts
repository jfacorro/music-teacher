import { describe, expect, it } from 'vitest';
import { ScoreView } from '../content/lessons';
import { ViewChoice, viewAtStart } from './viewChoice';

describe('viewAtStart', () => {
  it('keeps the usual view on automatic, and follows the setting otherwise', () => {
    expect(viewAtStart(ViewChoice.Auto, ScoreView.Sheet)).toBe(ScoreView.Sheet);
    expect(viewAtStart(ViewChoice.Auto, ScoreView.Falling)).toBe(ScoreView.Falling);
    expect(viewAtStart(ViewChoice.Falling, ScoreView.Sheet)).toBe(ScoreView.Falling);
    expect(viewAtStart(ViewChoice.Sheet, ScoreView.Falling)).toBe(ScoreView.Sheet);
  });
});
