/**
 * Standard MIDI files (.mid) → `ImportedMusic`, with `@tonejs/midi`. It splits the file into one
 * track per channel and instrument; drum tracks are left out.
 *
 * MIDI only stores which keys are played, so notes are spelled from the key signature (sharps,
 * or flats in flat keys). Timing is read in beats (ticks per quarter note), so it doesn't
 * depend on tempo changes.
 */
import { Midi } from '@tonejs/midi';
import { pitchFromMidi } from '../../theory/pitch';
import {
  type ImportedMusic,
  type ImportedTrack,
  ImportError,
  ImportErrorCode,
  ImportFormat,
  ImportWarning,
  quantize,
} from './importedMusic';

/** What MIDI assumes when a file doesn't say. */
const DEFAULT_TEMPO = 120;
const DEFAULT_TIME_SIGNATURE: [number, number] = [4, 4];

/** How @tonejs/midi names key signatures, from 7 flats to 7 sharps. */
const KEYS_BY_FIFTHS = 'Cb Gb Db Ab Eb Bb F C G D A E B F# C#'.split(' ');

export function parseMidiFile(bytes: Uint8Array): ImportedMusic {
  let midi: Midi;
  try {
    midi = new Midi(bytes);
  } catch (error) {
    throw new ImportError(ImportErrorCode.Unreadable, String(error));
  }
  const { header } = midi;
  const ppq = header.ppq;

  // The key signature's name stands for its number of sharps or flats (major or minor alike).
  const keyIndex = KEYS_BY_FIFTHS.indexOf(header.keySignatures[0]?.key ?? 'C');
  const keyFifths = keyIndex < 0 ? 0 : keyIndex - 7;

  const warnings: ImportWarning[] = [];
  const tempos = new Set(header.tempos.map((tempo) => Math.round(tempo.bpm)));
  if (tempos.size > 1) warnings.push(ImportWarning.TempoChanges);
  const meters = new Set(header.timeSignatures.map((ts) => ts.timeSignature.join('/')));
  if (meters.size > 1) warnings.push(ImportWarning.TimeSignatureChanges);

  let rounded = false;
  const tracks: ImportedTrack[] = midi.tracks
    .filter((track) => !track.instrument.percussion && track.notes.length > 0)
    .map((track) => {
      const quantized = quantize(
        track.notes.map((note) => ({
          pitch: pitchFromMidi(note.midi, { keyFifths }),
          start: note.ticks / ppq,
          duration: note.durationTicks / ppq,
        })),
      );
      rounded ||= quantized.rounded;
      return { name: track.name.trim() || null, staff: null, notes: quantized.notes };
    });
  if (tracks.length === 0) throw new ImportError(ImportErrorCode.NoNotes);
  if (rounded) warnings.unshift(ImportWarning.TimingRounded);

  const firstTempo = header.tempos[0]?.bpm;
  return {
    format: ImportFormat.Midi,
    title: header.name.trim() || null,
    composer: null,
    tempo: firstTempo ? Math.round(firstTempo) : DEFAULT_TEMPO,
    timeSignature: timeSignatureOf(header.timeSignatures[0]?.timeSignature),
    keyFifths,
    tracks,
    warnings,
  };
}

function timeSignatureOf(value: number[] | undefined): [number, number] {
  const [beats, beatType] = value ?? [];
  return beats && beatType && Number.isInteger(Math.log2(beatType))
    ? [beats, beatType]
    : DEFAULT_TIME_SIGNATURE;
}
