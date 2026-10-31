import { describe, expect, it } from 'vitest';
import { ChordQuality, IntervalName } from '../theory/chords';
import { IntervalNumber } from '../theory/intervals';
import { Mode } from '../theory/keys';
import { formatNote, type Pitch, pitchesOf, pitchOf } from '../theory/pitch';
import {
  answersOf,
  buildCards,
  cardFor,
  ChordInversion,
  Ending,
  Cadence,
  type IntervalAnswer,
  Numeral,
  type QuestionAnswer,
  keysFor,
  MAX_CHOICES,
  noteAbove,
  notesLeft,
  ScaleDegree,
  QuestionKind,
  type QuestionSet,
  singCards,
  StepSize,
  sungNotes,
  theoryQuestions,
} from './theoryQuestions';

const thirds: QuestionSet = {
  kind: QuestionKind.IntervalName,
  answers: [IntervalName.MinorThird, IntervalName.MajorThird],
  roots: pitchesOf('C4', 'D4', 'F4'),
  mode: Mode.Major,
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

  it('knows every answer of every kind about a distance', () => {
    const distances = [
      QuestionKind.StepSize,
      QuestionKind.IntervalNumber,
      QuestionKind.IntervalName,
    ];
    for (const kind of distances) {
      for (const answer of answersOf(kind)) {
        const above = noteAbove(kind, answer as IntervalAnswer, pitchOf('C4'));
        expect(above.midi).toBeGreaterThan(60);
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
      const answer = question.answer as IntervalAnswer;
      expect(question.targets).toEqual([noteAbove(thirds.kind, answer, question.root)]);
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
      expect(card.targets[0]!.midi).toBeLessThanOrEqual(range.high);
      expect(card.root.midi).toBe(60);
    }
  });

  it('keeps the spelling when it moves them', () => {
    const set = { ...thirds, answers: [IntervalName.MajorThird], roots: pitchesOf('D6') };
    expect(formatNote(singCards(set, 1, range)[0]!.targets[0]!)).toMatch(/^F#\d$/);
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

describe('cards about scales', () => {
  const inKey = { mode: Mode.Major };
  const d = pitchOf('D4');
  const names = (notes: readonly Pitch[]) => notes.map(formatNote);

  it('asks about the two notes of a real half or whole step in the scale', () => {
    const set = { ...inKey, kind: QuestionKind.ScaleStep };
    for (let i = 0; i < 20; i++) {
      const half = cardFor(set, StepSize.Half, d);
      expect([3, 7]).toContain(half.degree);
      expect(half.shown[1]!.midi - half.shown[0]!.midi).toBe(1);
      const whole = cardFor(set, StepSize.Whole, d);
      expect([1, 2, 4, 5, 6]).toContain(whole.degree);
      expect(whole.shown[1]!.midi - whole.shown[0]!.midi).toBe(2);
    }
  });

  it('finds a degree in the key, spelled by its signature, after the key is heard', () => {
    const card = cardFor({ ...inKey, kind: QuestionKind.ScaleDegree }, ScaleDegree.Third, d);
    expect(names(card.shown)).toEqual(['F#4']);
    expect(names(card.targets)).toEqual(['F#4']);
    expect(card.degree).toBe(3);
    expect(card.keyFifths).toBe(2);
    expect(names(card.sound[0]!)).toEqual(['D4', 'F#4', 'A4']);
    expect(names(card.sound[1]!)).toEqual(['F#4']);
  });

  it('counts degrees in the natural minor too', () => {
    const set = { kind: QuestionKind.ScaleDegree, mode: Mode.Minor };
    expect(names(cardFor(set, ScaleDegree.Third, pitchOf('A4')).targets)).toEqual(['C5']);
    expect(cardFor(set, ScaleDegree.Third, pitchOf('A4')).keyFifths).toBe(0);
  });

  it('asks for a scale’s notes after the one given, in order', () => {
    const set = { ...inKey, kind: QuestionKind.ScaleType };
    expect(names(cardFor(set, Mode.Major, pitchOf('G4')).targets)).toEqual([
      'A4',
      'B4',
      'C5',
      'D5',
      'E5',
      'F#5',
      'G5',
    ]);
    expect(names(cardFor(set, Mode.Minor, pitchOf('A4')).targets)).toEqual([
      'B4',
      'C5',
      'D5',
      'E5',
      'F5',
      'G5',
      'A5',
    ]);
  });

  it('ends a melody on the key note, or away from it', () => {
    const set = { ...inKey, kind: QuestionKind.HomeNote };
    const lastNote = (ending: Ending) => cardFor(set, ending, d).sound.at(-1)![0]!.midi % 12;
    for (let i = 0; i < 30; i++) {
      expect(lastNote(Ending.Home)).toBe(d.midi % 12);
      expect(lastNote(Ending.Away)).not.toBe(d.midi % 12);
    }
  });

  it('starts every melody from the key’s chord, and never asks to find anything', () => {
    const card = cardFor({ ...inKey, kind: QuestionKind.HomeNote }, Ending.Home, d);
    expect(names(card.sound[0]!)).toEqual(['D4', 'F#4', 'A4']);
    expect(card.targets).toEqual([]);
  });

  it('won’t make a card in a key no signature has', () => {
    expect(() =>
      cardFor({ ...inKey, kind: QuestionKind.ScaleDegree }, ScaleDegree.Third, pitchOf('G#4')),
    ).toThrow(RangeError);
  });

  it('moves everything a card shows, plays and asks for into a singer’s range', () => {
    const range = { low: 48, high: 72, comfortable: 60 };
    const set = {
      kind: QuestionKind.ScaleType,
      answers: [Mode.Major],
      roots: pitchesOf('G6'),
      mode: Mode.Major,
    };
    const [card] = singCards(set, 1, range);
    const midis = card!.sound.flat().map((note) => note.midi);
    expect(Math.min(...midis)).toBeGreaterThanOrEqual(range.low);
    expect(Math.max(...midis)).toBeLessThanOrEqual(range.high);
    expect(card!.targets.at(-1)!.midi).toBe(Math.max(...midis));
  });
});

describe('cards about keys', () => {
  const card = (kind: QuestionKind, answer: QuestionAnswer, root = pitchOf('G4')) =>
    cardFor({ kind, mode: Mode.Major }, answer, root);
  const names = (notes: readonly Pitch[]) => notes.map(formatNote);

  it('shows only the signature of the key asked', () => {
    const asked = card(QuestionKind.KeySignature, 'Eb');
    expect(asked.shown).toEqual([]);
    expect(asked.keyFifths).toBe(-3);
    expect(names(asked.sound[0]!)).toEqual(['Eb4', 'G4', 'Bb4']);
  });

  it('asks for the next sharp a fifth up, and the next flat a fourth up', () => {
    const sharp = card(QuestionKind.NextAccidental, 'G#');
    expect(sharp.keyFifths).toBe(2);
    expect(formatNote(sharp.root)).toBe('C#4');
    expect(names(sharp.targets)).toEqual(['G#4']);
    const flat = card(QuestionKind.NextAccidental, 'Ab');
    expect(flat.keyFifths).toBe(-2);
    expect(formatNote(flat.root)).toBe('Eb4');
    expect(names(flat.targets)).toEqual(['Ab4']);
  });

  it('can’t ask what comes after nothing', () => {
    expect(answersOf(QuestionKind.NextAccidental)).not.toContain('F#');
    expect(answersOf(QuestionKind.NextAccidental)).not.toContain('Bb');
  });

  it('starts from the neighbor on the circle', () => {
    const up = card(QuestionKind.CircleUp, 'D');
    expect(formatNote(up.root)).toBe('G4');
    expect(up.keyFifths).toBe(1);
    const down = card(QuestionKind.CircleDown, 'Bb');
    expect(formatNote(down.root)).toBe('F4');
    expect(down.keyFifths).toBe(-1);
    expect(formatNote(card(QuestionKind.CircleUp, 'C').root)).toBe('F4');
  });

  it('keeps the signature between relative keys', () => {
    const minor = card(QuestionKind.RelativeMinor, 'Bm');
    expect(formatNote(minor.root)).toBe('D4');
    expect(minor.keyFifths).toBe(2);
    expect(names(minor.targets)).toEqual(['B4']);
    const major = card(QuestionKind.RelativeMajor, 'Bb');
    expect(formatNote(major.root)).toBe('G4');
    expect(major.keyFifths).toBe(-2);
  });

  it('keeps a note’s degree when it moves to another key', () => {
    const moved = card(QuestionKind.TransposeNote, ScaleDegree.Third);
    expect(names(moved.shown)).toEqual(['E4']);
    expect(names(moved.targets)).toEqual(['B4']);
  });

  it('keeps a melody’s shape when it moves to another key', () => {
    const moved = card(QuestionKind.TransposeMelody, Ending.Home, pitchOf('D4'));
    expect(moved.shown.at(-1)!.step).toBe('C');
    expect(moved.targets.at(-1)!.step).toBe('D');
    const shape = (notes: readonly Pitch[]) =>
      notes.map((note) => note.midi - notes[0]!.midi).map((gap) => Math.sign(gap));
    expect(shape(moved.targets)).toEqual(shape(moved.shown));
  });
});

describe('cards about chords', () => {
  const inKey = { mode: Mode.Major };
  const names = (notes: readonly Pitch[]) => notes.map(formatNote);

  it('spells a chord in thirds, and asks for its notes in any order with none given', () => {
    const set = { ...inKey, kind: QuestionKind.ChordQuality };
    const card = cardFor(set, ChordQuality.Diminished, pitchOf('C4'));
    expect(names(card.shown)).toEqual(['C4', 'Eb4', 'Gb4']);
    expect(card.ordered).toBe(false);
    expect(card.given).toBeNull();
    expect(card.together).toBe(true);
  });

  it('plays a chord broken, then together', () => {
    const card = cardFor(
      { ...inKey, kind: QuestionKind.ChordQuality },
      ChordQuality.Minor,
      pitchOf('D4'),
    );
    expect(card.sound.map((notes) => names(notes).join('+'))).toEqual([
      'D4',
      'F4',
      'A4',
      'D4+F4+A4',
    ]);
  });

  it('moves the lowest notes up for an inversion, keeping the chord’s root', () => {
    const set = { ...inKey, kind: QuestionKind.ChordInversion };
    const first = cardFor(set, ChordInversion.First, pitchOf('C4'));
    expect(names(first.shown)).toEqual(['E4', 'G4', 'C5']);
    expect(formatNote(first.root)).toBe('C4');
    expect(first.ordered).toBe(true);
    expect(first.given).toBeNull();
    const second = cardFor(set, ChordInversion.Second, pitchOf('C4'));
    expect(names(second.shown)).toEqual(['G4', 'C5', 'E5']);
    const minor = cardFor({ ...set, mode: Mode.Minor }, ChordInversion.Root, pitchOf('D4'));
    expect(names(minor.shown)).toEqual(['D4', 'F4', 'A4']);
  });

  it('sings a chord from its root, which is played first', () => {
    const card = cardFor(
      { ...inKey, kind: QuestionKind.ChordQuality },
      ChordQuality.Major,
      pitchOf('C4'),
    );
    const notes = sungNotes([card]);
    expect(notes.map(({ note }) => formatNote(note))).toEqual(['C4', 'E4', 'G4']);
    expect(formatNote(notes[0]!.given)).toBe('C4');
  });
});

describe('cards about harmony', () => {
  const inKey = { mode: Mode.Major };
  const names = (notes: readonly Pitch[]) => notes.map(formatNote);
  const numeral = (answer: Numeral, root = pitchOf('C4')) =>
    cardFor({ ...inKey, kind: QuestionKind.RomanNumeral }, answer, root);

  it('builds each numeral from the notes of the scale', () => {
    expect(names(numeral(Numeral.One).shown)).toEqual(['C4', 'E4', 'G4']);
    expect(names(numeral(Numeral.Two).shown)).toEqual(['D4', 'F4', 'A4']);
    expect(names(numeral(Numeral.Six).shown)).toEqual(['A4', 'C5', 'E5']);
    expect(names(numeral(Numeral.Seven).shown)).toEqual(['B4', 'D5', 'F5']);
    expect(names(numeral(Numeral.FiveSeven).shown)).toEqual(['G4', 'B4', 'D5', 'F5']);
    expect(names(numeral(Numeral.Four, pitchOf('D4')).shown)).toEqual(['G4', 'B4', 'D5']);
    expect(names(numeral(Numeral.Five, pitchOf('D4')).shown)).toEqual(['A4', 'C#5', 'E5']);
  });

  it('makes each numeral the chord its case says', () => {
    const qualities = [Numeral.One, Numeral.Two, Numeral.Three, Numeral.Four, Numeral.Five, Numeral.Six, Numeral.Seven]; // prettier-ignore
    for (const answer of qualities) {
      const [root, third, fifth] = numeral(answer).shown.map((note) => note.midi);
      const size = [third! - root!, fifth! - root!].join();
      const expected =
        answer === Numeral.Seven ? '3,6' : answer === answer.toUpperCase() ? '4,7' : '3,7';
      expect(size).toBe(expected);
    }
  });

  it('plays the key, then the chord, and keeps the tonic to count from', () => {
    const card = numeral(Numeral.Four, pitchOf('G4'));
    expect(names(card.sound[0]!)).toEqual(['G4', 'B4', 'D5']);
    expect(names(card.sound[1]!)).toEqual(['C5', 'E5', 'G5']);
    expect(formatNote(card.given!)).toBe('G4');
    expect(card.ordered).toBe(false);
    expect(card.keyFifths).toBe(1);
  });

  it('finds the dominant seventh of a key, a fifth above', () => {
    const card = cardFor({ ...inKey, kind: QuestionKind.DominantOf }, 'D', pitchOf('C4'));
    expect(formatNote(card.root)).toBe('G4');
    expect(names(card.targets)).toEqual(['D4', 'F#4', 'A4', 'C5']);
    expect(card.shown).toEqual([]);
  });

  it('ends each cadence as it says, after the same start', () => {
    const set = { ...inKey, kind: QuestionKind.Cadence };
    const bass = (ending: Cadence) =>
      cardFor(set, ending, pitchOf('C4')).sound.map((chord) => formatNote(chord[0]!));
    expect(bass(Cadence.Authentic)).toEqual(['C3', 'A3', 'G3', 'C3']);
    expect(bass(Cadence.Half)).toEqual(['C3', 'A3', 'F3', 'G3']);
    expect(bass(Cadence.Plagal)).toEqual(['C3', 'A3', 'F3', 'C3']);
  });

  it('keeps a cadence’s upper notes close together above the tonic', () => {
    const card = cardFor(
      { ...inKey, kind: QuestionKind.Cadence },
      Cadence.Authentic,
      pitchOf('C4'),
    );
    expect(names(card.sound[2]!)).toEqual(['G3', 'D4', 'G4', 'B4']);
    for (const chord of card.sound) {
      const upper = chord.slice(1).map((note) => note.midi);
      expect(Math.min(...upper)).toBeGreaterThanOrEqual(60);
      expect(Math.max(...upper)).toBeLessThan(72);
    }
  });
});

describe('notesLeft', () => {
  const names = (notes: readonly Pitch[]) => notes.map(formatNote);

  it('asks again for a note a melody repeats', () => {
    const melody = cardFor(
      { kind: QuestionKind.TransposeMelody, mode: Mode.Major },
      Ending.Away,
      pitchOf('C4'),
      () => 0,
    );
    expect(names(melody.targets)).toEqual(['C4', 'D4', 'E4', 'D4']);
    const [, second, third] = melody.targets;
    expect(names(notesLeft(melody, [melody.targets[0]!, second!, third!]))).toEqual(['D4']);
    expect(notesLeft(melody, melody.targets)).toEqual([]);
  });

  it('takes a chord’s notes in any order', () => {
    const chord = cardFor(
      { kind: QuestionKind.ChordQuality, mode: Mode.Major },
      ChordQuality.Major,
      pitchOf('C4'),
    );
    expect(names(notesLeft(chord, [chord.targets[1]!]))).toEqual(['C4', 'G4']);
  });
});

describe('sungNotes', () => {
  it('sings a card’s notes one at a time, each after the one before', () => {
    const card = cardFor(
      { kind: QuestionKind.ScaleType, mode: Mode.Major },
      Mode.Major,
      pitchOf('C4'),
    );
    const notes = sungNotes([card]);
    expect(notes).toHaveLength(7);
    expect(formatNote(notes[0]!.given)).toBe('C4');
    expect(formatNote(notes[0]!.note)).toBe('D4');
    expect(formatNote(notes[1]!.given)).toBe('D4');
    expect(notes[6]!.place).toBe(6);
  });

  it('asks for whole cards only, up to a few notes', () => {
    const scale = cardFor(
      { kind: QuestionKind.ScaleType, mode: Mode.Major },
      Mode.Major,
      pitchOf('C4'),
    );
    expect(sungNotes([scale, scale, scale])).toHaveLength(7);
    const third = cardFor(thirds, IntervalName.MajorThird, pitchOf('C4'));
    expect(sungNotes(Array.from({ length: 6 }, () => third))).toHaveLength(6);
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
