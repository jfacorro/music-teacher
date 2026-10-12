/** Test helpers: build scores and scripted note events tersely. */
import { parseInlineScore } from '../content/loaders/inlineScore';
import type { NoteEvent } from '../input/types';
import type { Hand, Score } from './score';

/** `[note, start, duration = 1, hand = 'R']` per note. */
export type NoteSpec = [string, number, number?, Hand?];

export function scoreOf(
  specs: NoteSpec[],
  tempo = 60,
  timeSignature: [number, number] = [4, 4],
): Score {
  return parseInlineScore(
    {
      tempo,
      timeSignature,
      notes: specs.map(([note, start, duration = 1, hand = 'R']) => ({
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
  source: NoteEvent['source'] = 'midi',
): NoteEvent {
  return { type: 'on', pitch, velocity: 100, time, source };
}

export function noteOff(
  pitch: number,
  time: number,
  source: NoteEvent['source'] = 'midi',
): NoteEvent {
  return { type: 'off', pitch, velocity: 0, time, source };
}
