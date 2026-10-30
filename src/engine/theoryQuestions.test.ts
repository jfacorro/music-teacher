import { describe, expect, it } from 'vitest';
import { IntervalName } from '../theory/chords';
import { IntervalNumber } from '../theory/intervals';
import { formatNote, pitchesOf, pitchOf } from '../theory/pitch';
import {
  answersOf,
  buildCards,
  type IntervalSet,
  keysFor,
  MAX_CHOICES,
  noteAbove,
  QuestionKind,
  singCards,
  StepSize,
  theoryQuestions,
} from './theoryQuestions';

const thirds: IntervalSet = {
  kind: QuestionKind.IntervalName,
  answers: [IntervalName.MinorThird, IntervalName.MajorThird],
  roots: pitchesOf('C4', 'D4', 'F4'),
};

describe('noteAbove', () => {
  it('leads to the note each kind of answer names', () => {
    const above = (kind: QuestionKind, answer: Parameters<typeof noteAbove>[1]) =>
      formatNote(noteAbove(kind, answer, pitchOf('D4')));
    expect(above(QuestionKind.StepSize, StepSize.Half)).toBe('D#4');
    expect(above(QuestionKind.StepSize, StepSize.Whole)).toBe('E4');
    expect(above(QuestionKind.IntervalNumber, IntervalNumber.Third)).toBe('F4');
    expect(above(QuestionKind.IntervalName, IntervalName.MajorThird)).toBe('F#4');
  });

  it('knows every answer of every kind', () => {
    for (const kind of Object.values(QuestionKind)) {
      for (const answer of answersOf(kind)) {
        expect(noteAbove(kind, answer, pitchOf('C4')).midi).toBeGreaterThan(60);
      }
    }
  });
});

describe('theoryQuestions', () => {
  it('deals each answer as evenly as it can, with the notes that match it', () => {
    const questions = theoryQuestions(thirds, 8);
    const count = (answer: IntervalName) => questions.filter((q) => q.answer === answer).length;
    expect(count(IntervalName.MinorThird)).toBe(4);
    expect(count(IntervalName.MajorThird)).toBe(4);
    for (const question of questions) {
      expect(question.top).toEqual(noteAbove(thirds.kind, question.answer, question.root));
    }
  });

  it('offers every answer when there are few', () => {
    expect(theoryQuestions(thirds, 1)[0]!.choices).toEqual([
      IntervalName.MinorThird,
      IntervalName.MajorThird,
    ]);
  });

  it('offers a few of many answers, always the right one, smallest first', () => {
    const answers = answersOf(QuestionKind.IntervalName);
    const set = { ...thirds, answers };
    for (const { answer, choices } of theoryQuestions(set, 40)) {
      expect(choices).toHaveLength(MAX_CHOICES);
      expect(choices).toContain(answer);
      expect(choices).toEqual(answers.filter((other) => choices.includes(other)));
    }
  });
});

describe('singCards', () => {
  const range = { low: 48, high: 67, comfortable: 57 };

  it('moves the notes into the range, near the comfortable note', () => {
    const set = { ...thirds, roots: pitchesOf('C6') };
    for (const card of singCards(set, 4, range)) {
      expect(card.root.midi).toBeGreaterThanOrEqual(range.low);
      expect(card.top.midi).toBeLessThanOrEqual(range.high);
      expect(card.root.midi).toBe(60);
    }
  });

  it('keeps the spelling when it moves them', () => {
    const set = { ...thirds, answers: [IntervalName.MajorThird], roots: pitchesOf('D6') };
    expect(formatNote(singCards(set, 1, range)[0]!.top)).toMatch(/^F#\d$/);
  });

  it('doesn’t ask for an octave, which the note given would match', () => {
    const set = {
      ...thirds,
      answers: [IntervalName.PerfectFifth, IntervalName.Octave],
    };
    for (const card of singCards(set, 8, range)) {
      expect(card.answer).toBe(IntervalName.PerfectFifth);
    }
  });
});

describe('keysFor', () => {
  it('shows every card, from a C to a C', () => {
    const set = { ...thirds, answers: [IntervalName.MajorThird], roots: pitchesOf('D4', 'A4') };
    const cards = buildCards(set, 4);
    const [low, high] = keysFor(cards);
    expect(low).toBe(60);
    expect(high).toBe(84);
  });
});
