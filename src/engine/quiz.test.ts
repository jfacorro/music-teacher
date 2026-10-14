import { describe, expect, it } from 'vitest';
import { parseNote } from '../theory/pitch';
import { resolvePlayed } from './micAliases';
import { quizCards, quizResult } from './quiz';
import { parseRhythm, RhythmError } from './rhythm';

/** A repeatable "random" sequence. */
function seeded(seed: number) {
  return () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
}

describe('quizCards', () => {
  const notes = ['C4', 'D4', 'E4', 'F4'].map(parseNote);

  it('deals the requested number of cards, each note as evenly as possible', () => {
    const cards = quizCards(notes, 10, seeded(1));
    expect(cards).toHaveLength(10);
    const counts = notes.map((note) => cards.filter((card) => card.midi === note.midi).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('never shows the same note twice in a row when there is a choice', () => {
    for (let seed = 1; seed < 50; seed++) {
      const cards = quizCards(notes, 20, seeded(seed));
      cards.slice(1).forEach((card, i) => expect(card.midi).not.toBe(cards[i]!.midi));
    }
    expect(quizCards([parseNote('C4')], 3).map((card) => card.midi)).toEqual([60, 60, 60]);
    expect(quizCards([], 3)).toEqual([]);
  });

  it('scores first-try answers like the stars', () => {
    expect(quizResult(10, 10)).toEqual({ firstTry: 10, total: 10, accuracy: 1, stars: 3 });
    expect(quizResult(8, 10)).toMatchObject({ accuracy: 0.8, stars: 2 });
    expect(quizResult(5, 10).stars).toBe(0);
  });
});

describe('resolvePlayed', () => {
  it('lets the microphone’s octave and harmonic mix-ups count as the expected note', () => {
    expect(resolvePlayed(72, 'mic', [60])).toBe(60);
    expect(resolvePlayed(79, 'mic', [60])).toBe(60); // octave + fifth
    expect(resolvePlayed(62, 'mic', [60])).toBe(62);
    expect(resolvePlayed(72, 'midi', [60])).toBe(72); // MIDI is exact
  });
});

describe('parseRhythm', () => {
  it('reads note values, dots and rests, bar by bar', () => {
    expect(parseRhythm('q q h | e e q rq q', [4, 4])).toEqual([
      { start: 0, duration: 1 },
      { start: 1, duration: 1 },
      { start: 2, duration: 2 },
      { start: 4, duration: 0.5 },
      { start: 4.5, duration: 0.5 },
      { start: 5, duration: 1 },
      { start: 7, duration: 1 },
    ]);
    expect(parseRhythm('h. | q s s e q', [3, 4])).toEqual([
      { start: 0, duration: 3 },
      { start: 3, duration: 1 },
      { start: 4, duration: 0.25 },
      { start: 4.25, duration: 0.25 },
      { start: 4.5, duration: 0.5 },
      { start: 5, duration: 1 },
    ]);
  });

  it('rejects unknown values and bars that are too short or too long', () => {
    expect(() => parseRhythm('q q x q', [4, 4])).toThrow(RhythmError);
    expect(() => parseRhythm('q q q', [4, 4])).toThrow(/bar 1 lasts 3 beats instead of 4/);
    expect(() => parseRhythm('w | w q', [4, 4])).toThrow(/bar 2/);
    expect(() => parseRhythm(' | ', [4, 4])).toThrow(/empty/);
  });
});
