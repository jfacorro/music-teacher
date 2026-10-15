/** Test helpers: build scores and scripted note events tersely. */
import { parseInlineScore } from '../content/loaders/inlineScore';
import { type NoteEvent, InputSource, NoteEventType } from '../input/types';
import type { NoteString } from '../theory/pitch';
import { Hand, type Score } from './score';

/** `[note, start, duration = 1, hand = 'R']` per note. */
export type NoteSpec = [NoteString, number, number?, Hand?];

export function scoreOf(
  specs: NoteSpec[],
  tempo = 60,
  timeSignature: [number, number] = [4, 4],
): Score {
  return parseInlineScore(
    {
      tempo,
      timeSignature,
      notes: specs.map(([note, start, duration = 1, hand = Hand.Right]) => ({
        note,
        start,
        duration,
        hand,
      })),
    },
    'test',
  );
}

export function noteOn(
  pitch: number,
  time: number,
  source: NoteEvent['source'] = InputSource.Midi,
): NoteEvent {
  return { type: NoteEventType.On, pitch, velocity: 100, time, source };
}

export function noteOff(
  pitch: number,
  time: number,
  source: NoteEvent['source'] = InputSource.Midi,
): NoteEvent {
  return { type: NoteEventType.Off, pitch, velocity: 0, time, source };
}
