import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import { formatNote } from '../../theory/pitch';
import { ImportErrorCode, ImportFormat, ImportWarning } from './importedMusic';
import { parseMidiFile } from './midiFile';

/** Ticks per quarter note (the library's default). */
const Q = 480;

function midiFile(build: (midi: Midi) => void): Uint8Array {
  const midi = new Midi();
  build(midi);
  return midi.toArray();
}

function melody(midi: Midi, notes: [number, number, number][], name = 'Melody') {
  const track = midi.addTrack();
  track.name = name;
  for (const [key, ticks, durationTicks] of notes)
    track.addNote({ midi: key, ticks, durationTicks });
  return track;
}

/**
 * Sets the key signature's sharps (positive) or flats: the library writes it wrongly (it reads
 * it right).
 */
function withKeySignature(bytes: Uint8Array, fifths: number): Uint8Array {
  const at = bytes.findIndex(
    (byte, i) => byte === 0xff && bytes[i + 1] === 0x59 && bytes[i + 2] === 2,
  );
  const fixed = bytes.slice();
  fixed[at + 3] = fifths & 0xff;
  return fixed;
}

const written = (notes: { pitch: { midi: number }; start: number; duration: number }[]) =>
  notes.map((note) => [note.pitch.midi, note.start, note.duration]);

describe('parseMidiFile', () => {
  it('reads the tracks in beats, with the tempo and time signature', () => {
    const music = parseMidiFile(
      midiFile((midi) => {
        midi.header.setTempo(90);
        midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4], measures: 0 });
        melody(midi, [
          [64, 0, Q],
          [62, Q, Q / 2],
          [60, Q * 1.5, Q * 1.5],
        ]);
        melody(midi, [[48, 0, Q * 3]], 'Bass');
      }),
    );
    expect(music.format).toBe(ImportFormat.Midi);
    expect(music.tempo).toBe(90);
    expect(music.timeSignature).toEqual([3, 4]);
    expect(music.tracks.map((track) => track.name)).toEqual(['Melody', 'Bass']);
    expect(written(music.tracks[0]!.notes)).toEqual([
      [64, 0, 1],
      [62, 1, 0.5],
      [60, 1.5, 1.5],
    ]);
    expect(written(music.tracks[1]!.notes)).toEqual([[48, 0, 3]]);
    expect(music.tracks[0]!.staff).toBeNull();
    expect(music.warnings).toEqual([]);
  });

  it('assumes 120 BPM and 4/4 when the file doesn’t say', () => {
    const music = parseMidiFile(midiFile((midi) => melody(midi, [[60, 0, Q]])));
    expect(music.tempo).toBe(120);
    expect(music.timeSignature).toEqual([4, 4]);
    expect(music.keyFifths).toBe(0);
  });

  it('spells notes from the key signature', () => {
    const music = (fifths: number) =>
      parseMidiFile(
        withKeySignature(
          midiFile((midi) => {
            midi.header.keySignatures.push({ ticks: 0, key: 'C', scale: 'major' });
            melody(midi, [[70, 0, Q]]);
          }),
          fifths,
        ),
      );
    expect(music(-1).keyFifths).toBe(-1);
    expect(formatNote(music(-1).tracks[0]!.notes[0]!.pitch)).toBe('Bb4');
    expect(music(2).keyFifths).toBe(2);
    expect(formatNote(music(2).tracks[0]!.notes[0]!.pitch)).toBe('A#4');
  });

  it('leaves out drum tracks and empty tracks', () => {
    const music = parseMidiFile(
      midiFile((midi) => {
        melody(midi, [[60, 0, Q]]);
        melody(midi, [[36, 0, Q]], 'Drums').channel = 9;
        midi.addTrack().name = 'Empty';
      }),
    );
    expect(music.tracks.map((track) => track.name)).toEqual(['Melody']);
  });

  it('rounds a played performance to sixteenth notes, and says so', () => {
    const music = parseMidiFile(
      midiFile((midi) =>
        melody(midi, [
          [60, 10, Q - 30],
          [62, Q - 5, 20],
        ]),
      ),
    );
    expect(written(music.tracks[0]!.notes)).toEqual([
      [60, 0, 1],
      [62, 1, 0.25],
    ]);
    expect(music.warnings).toEqual([ImportWarning.TimingRounded]);
  });

  it('warns about tempo and time signature changes', () => {
    const music = parseMidiFile(
      midiFile((midi) => {
        midi.header.tempos.push({ ticks: 0, bpm: 100 }, { ticks: Q * 4, bpm: 80 });
        midi.header.timeSignatures.push(
          { ticks: 0, timeSignature: [4, 4], measures: 0 },
          { ticks: Q * 4, timeSignature: [3, 4], measures: 1 },
        );
        melody(midi, [[60, 0, Q]]);
      }),
    );
    expect(music.tempo).toBe(100);
    expect(music.warnings).toEqual([
      ImportWarning.TempoChanges,
      ImportWarning.TimeSignatureChanges,
    ]);
  });

  it('rejects files without notes, and damaged files', () => {
    expect(() => parseMidiFile(midiFile((midi) => void midi.addTrack()))).toThrow(
      expect.objectContaining({ code: ImportErrorCode.NoNotes }),
    );
    const damaged = new TextEncoder().encode('MThd and then nothing that makes sense');
    expect(() => parseMidiFile(damaged)).toThrow(
      expect.objectContaining({ code: ImportErrorCode.Unreadable }),
    );
  });
});
