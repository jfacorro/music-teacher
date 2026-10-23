import { describe, expect, it } from 'vitest';
import { InputSource } from '../input/types';
import {
  compareRun,
  PlayedVerdict,
  Recorder,
  type Recording,
  soundingEnd,
  writtenFor,
} from './recording';
import { Hand } from './score';
import { HandFilter } from './session';
import { scoreOf } from './testUtils';
import { MIC_WINDOWS, MIDI_WINDOWS } from './timing';

const C4 = 60;
const D4 = 62;
const E4 = 64;

describe('Recorder', () => {
  it('turns presses and releases into notes, ending keys still down', () => {
    const recorder = new Recorder();
    recorder.press(C4, 80, InputSource.Midi, 0);
    recorder.press(E4, 90, InputSource.Midi, 0);
    recorder.release(C4, 0.9);
    recorder.press(C4, 70, InputSource.Midi, 1); // the same key again
    expect(recorder.finish(2)).toEqual([
      { pitch: C4, velocity: 80, source: 'midi', start: 0, end: 0.9 },
      { pitch: E4, velocity: 90, source: 'midi', start: 0, end: 2 },
      { pitch: C4, velocity: 70, source: 'midi', start: 1, end: 2 },
    ]);
  });
});

/** At 60 BPM a beat is a second: 0.1 beats = 100 ms. */
function recording(
  notes: [number, number][],
  windows: Recording['windows'] = MIDI_WINDOWS,
  source: InputSource = InputSource.Midi,
): Recording {
  return {
    notes: notes.map(([pitch, start]) => ({
      pitch,
      velocity: 80,
      source,
      start,
      end: start + 0.5,
    })),
    tempo: 60,
    hands: HandFilter.Both,
    from: 0,
    to: 3,
    windows,
  };
}

const verdicts = (comparison: ReturnType<typeof compareRun>) =>
  comparison.played.map((note) => [note.pitch, note.verdict]);

describe('Recorder: the pedal', () => {
  it('keeps when the pedal was held, until the end if it still is', () => {
    const recorder = new Recorder();
    recorder.pedal(true, 0);
    recorder.pedal(true, 0.5); // still down
    recorder.pedal(false, 2);
    recorder.pedal(false, 2.5); // still up
    recorder.pedal(true, 3);
    expect(recorder.pedalHeld(4)).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 4 },
    ]);
  });

  it('lets a note sound on while the pedal holds it', () => {
    const note = { pitch: 60, velocity: 64, source: InputSource.Midi, start: 0, end: 1 };
    expect(soundingEnd(note, [{ start: 0.5, end: 3 }])).toBe(3);
    expect(soundingEnd(note, [{ start: 1.5, end: 3 }])).toBe(1);
    expect(soundingEnd(note)).toBe(1);
  });
});

describe('compareRun', () => {
  const score = scoreOf([
    ['C4', 0],
    ['D4', 1],
    ['E4', 2],
  ]);

  it('calls each key on time, early, late or wrong (tempo mode)', () => {
    const comparison = compareRun(
      score.notes,
      recording([
        [C4, 0.02],
        [D4, 0.88],
        [E4, 2.12],
        [65, 2.5],
      ]),
    );
    expect(verdicts(comparison)).toEqual([
      [C4, PlayedVerdict.OnTime],
      [D4, PlayedVerdict.Early],
      [E4, PlayedVerdict.Late],
      [65, PlayedVerdict.Wrong],
    ]);
    expect(comparison.missed).toEqual([]);
  });

  it('lists the notes nobody played, and doesn’t count a key twice', () => {
    const comparison = compareRun(
      score.notes,
      recording([
        [C4, 0],
        [C4, 0.05],
      ]),
    );
    expect(verdicts(comparison)).toEqual([
      [C4, PlayedVerdict.OnTime],
      [C4, PlayedVerdict.Wrong],
    ]);
    expect(comparison.missed.map((note) => note.pitch.midi)).toEqual([D4, E4]);
  });

  it('in wait mode, counts the keys the music waited for, in order, however early', () => {
    const comparison = compareRun(
      score.notes,
      recording(
        [
          [C4, -1.5], // during the lead-in
          [65, 0.5],
          [C4, 0.8], // again, while D4 is next
          [D4, 1],
          [E4, 2],
        ],
        null,
      ),
    );
    expect(verdicts(comparison)).toEqual([
      [C4, PlayedVerdict.Correct],
      [65, PlayedVerdict.Wrong],
      [C4, PlayedVerdict.Wrong],
      [D4, PlayedVerdict.Correct],
      [E4, PlayedVerdict.Correct],
    ]);
    expect(comparison.missed).toEqual([]);
  });

  it('doesn’t grade the other hand’s keys, or playing around before the music starts', () => {
    const both = scoreOf([
      ['C4', 0],
      ['C3', 1, 1, Hand.Left],
    ]);
    const comparison = compareRun(both.notes, {
      ...recording([
        [D4, -3], // the count-in
        [C4, 0],
        [48, 1],
      ]),
      hands: HandFilter.Right,
      to: 2,
    });
    expect(verdicts(comparison)).toEqual([
      [D4, PlayedVerdict.Ungraded],
      [C4, PlayedVerdict.OnTime],
      [48, PlayedVerdict.Ungraded],
    ]);
  });

  it('with the microphone, one key of a chord plays all of it', () => {
    const chord = scoreOf([
      ['C4', 0],
      ['E4', 0],
    ]);
    const comparison = compareRun(chord.notes, recording([[C4, 0]], MIC_WINDOWS, InputSource.Mic));
    expect(comparison.missed).toEqual([]);
  });

  it('compares with the hands practiced, within the stretch played', () => {
    const both = scoreOf([
      ['C4', 0],
      ['C3', 0, 1, Hand.Left],
      ['E4', 4],
    ]);
    const rightOnly = { ...recording([]), hands: HandFilter.Right, to: 4 };
    expect(writtenFor(both.notes, rightOnly).map((note) => note.pitch.midi)).toEqual([C4]);
  });
});
