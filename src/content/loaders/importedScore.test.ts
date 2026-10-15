import { describe, expect, it } from 'vitest';
import { Hand } from '../../engine/score';
import { formatNote, type NoteString, pitchOf } from '../../theory/pitch';
import {
  type ImportedMusic,
  type ImportedTrack,
  ImportFormat,
  quantize,
  suggestHands,
  TrackHand,
} from './importedMusic';
import { defaultImportOptions, importedScore, transposeKey } from './importedScore';

/** `[note, start, duration]` per note. */
function track(
  notes: [NoteString, number, number][],
  name: string | null = null,
  staff: number | null = null,
): ImportedTrack {
  return {
    name,
    staff,
    notes: notes.map(([note, start, duration]) => ({ pitch: pitchOf(note), start, duration })),
  };
}

function music(tracks: ImportedTrack[], keyFifths = 0): ImportedMusic {
  return {
    format: ImportFormat.Midi,
    title: 'Test',
    composer: null,
    tempo: 96,
    timeSignature: [4, 4],
    keyFifths,
    tracks,
    warnings: [],
  };
}

const melody = track([
  ['E5', 0, 1],
  ['D5', 1, 1],
  ['C5', 2, 2],
]);
const bass = track([
  ['C3', 0, 4],
  ['G2', 4, 4],
]);

const notesOf = (result: ReturnType<typeof importedScore>) =>
  result.score?.notes.map((note) => [formatNote(note.pitch), note.start, note.duration, note.hand]);

describe('importedScore', () => {
  it('gives each track to the chosen hand, at the chosen tempo', () => {
    const result = importedScore(music([melody, bass]), {
      hands: [TrackHand.Right, TrackHand.Left],
      transpose: 0,
      tempo: 72,
    });
    expect(notesOf(result)).toEqual([
      ['C3', 0, 4, Hand.Left],
      ['E5', 0, 1, Hand.Right],
      ['D5', 1, 1, Hand.Right],
      ['C5', 2, 2, Hand.Right],
      ['G2', 4, 4, Hand.Left],
    ]);
    expect(result.score?.tempo).toBe(72);
    expect(result.score?.measures).toEqual([
      { start: 0, length: 4 },
      { start: 4, length: 4 },
    ]);
  });

  it('splits a track at middle C, and leaves tracks out', () => {
    const both = track([
      ['B3', 0, 1],
      ['C4', 1, 1],
    ]);
    const result = importedScore(music([both, bass]), {
      hands: [TrackHand.Split, TrackHand.None],
      transpose: 0,
      tempo: 96,
    });
    expect(notesOf(result)).toEqual([
      ['B3', 0, 1, Hand.Left],
      ['C4', 1, 1, Hand.Right],
    ]);
  });

  it('has no score when no track is played', () => {
    const result = importedScore(music([melody]), {
      hands: [TrackHand.None],
      transpose: 0,
      tempo: 96,
    });
    expect(result.score).toBeNull();
  });

  it('transposes into the new key, leaving out notes off the keyboard', () => {
    const result = importedScore(
      music(
        [
          track([
            ['F#4', 0, 1],
            ['A0', 1, 1],
          ]),
        ],
        1,
      ),
      { hands: [TrackHand.Right], transpose: -2, tempo: 96 },
    );
    expect(result.score?.keyFifths).toBe(-1); // G major → F major
    expect(notesOf(result)).toEqual([['E4', 0, 1, Hand.Right]]);
    expect(result.outOfRange).toBe(1);

    const up = importedScore(
      music(
        [
          track([
            ['Bb4', 0, 1],
            ['C8', 1, 1],
          ]),
        ],
        -2,
      ),
      { hands: [TrackHand.Right], transpose: 1, tempo: 96 },
    );
    expect(up.score?.keyFifths).toBe(5); // B♭ major → B major
    expect(notesOf(up)).toEqual([['B4', 0, 1, Hand.Right]]);
    expect(up.outOfRange).toBe(1);
  });

  it('plays each key once at a time', () => {
    const result = importedScore(
      music([
        track([
          ['C4', 0, 4],
          ['C4', 2, 1],
        ]),
        track([['C4', 0, 2]]),
      ]),
      { hands: [TrackHand.Right, TrackHand.Left], transpose: 0, tempo: 96 },
    );
    expect(notesOf(result)).toEqual([
      ['C4', 0, 2, Hand.Right],
      ['C4', 2, 1, Hand.Right],
    ]);
  });

  it('starts from the suggested hands and the file’s tempo', () => {
    expect(defaultImportOptions(music([melody, bass]))).toEqual({
      hands: [TrackHand.Right, TrackHand.Left],
      transpose: 0,
      tempo: 96,
    });
  });
});

describe('transposeKey', () => {
  it('moves along the circle of fifths', () => {
    expect(transposeKey(0, 0)).toBe(0);
    expect(transposeKey(0, 2)).toBe(2); // C → D
    expect(transposeKey(0, 1)).toBe(-5); // C → D♭
    expect(transposeKey(0, -1)).toBe(5); // C → B
    expect(transposeKey(-6, 0)).toBe(-6); // unchanged: G♭ stays G♭
    expect(transposeKey(0, 12)).toBe(0);
  });
});

describe('suggestHands', () => {
  it('gives a piano part’s top staff to the right hand and the bottom one to the left', () => {
    expect(
      suggestHands([
        track([['C2', 0, 1]], 'Voice'),
        track([['C5', 0, 1]], 'Piano', 1),
        track([['C3', 0, 1]], 'Piano', 2),
      ]),
    ).toEqual([TrackHand.None, TrackHand.Right, TrackHand.Left]);
  });

  it('otherwise gives the highest track to the right hand and the lowest to the left', () => {
    expect(suggestHands([bass, melody, track([['G4', 0, 1]])])).toEqual([
      TrackHand.Left,
      TrackHand.Right,
      TrackHand.None,
    ]);
  });

  it('splits a single track with notes on both sides of middle C', () => {
    expect(
      suggestHands([
        track([
          ['C3', 0, 1],
          ['E5', 1, 1],
        ]),
      ]),
    ).toEqual([TrackHand.Split]);
    expect(suggestHands([melody])).toEqual([TrackHand.Right]);
    expect(suggestHands([bass])).toEqual([TrackHand.Left]);
  });
});

describe('quantize', () => {
  it('rounds to sixteenth notes, never to nothing', () => {
    const { notes, rounded } = quantize([
      { pitch: pitchOf('C4'), start: 0.02, duration: 0.05 },
      { pitch: pitchOf('D4'), start: 1, duration: 0.5 },
    ]);
    expect(notes.map((note) => [note.start, note.duration])).toEqual([
      [0, 0.25],
      [1, 0.5],
    ]);
    expect(rounded).toBe(true);
    expect(quantize([{ pitch: pitchOf('C4'), start: 0.75, duration: 0.25 }]).rounded).toBe(false);
  });
});
