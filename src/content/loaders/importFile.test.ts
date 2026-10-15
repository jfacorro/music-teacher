// @vitest-environment jsdom
import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import { ImportErrorCode, ImportFormat } from './importedMusic';
import { MAX_IMPORT_BYTES, parseMusicBytes, readMusicFile } from './importFile';
import { utf16, utf8, zip } from './zipFixture';

const SCORE =
  '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0">' +
  '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
  '<part id="P1"><measure><attributes><divisions>1</divisions></attributes>' +
  '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>' +
  '</measure></part></score-partwise>';

function midiBytes(): Uint8Array {
  const midi = new Midi();
  midi.addTrack().addNote({ midi: 60, ticks: 0, durationTicks: 480 });
  return midi.toArray();
}

describe('parseMusicBytes', () => {
  it('tells the formats apart by their content', async () => {
    expect((await parseMusicBytes(midiBytes())).format).toBe(ImportFormat.Midi);
    expect((await parseMusicBytes(utf8(SCORE))).format).toBe(ImportFormat.MusicXml);
    expect((await parseMusicBytes(utf16(SCORE))).format).toBe(ImportFormat.MusicXml);
    const mxl = await zip([{ name: 'song.musicxml', data: utf8(SCORE), compress: true }]);
    expect((await parseMusicBytes(mxl)).format).toBe(ImportFormat.MusicXml);
  });

  it('rejects other files', async () => {
    await expect(parseMusicBytes(utf8('Just some text'))).rejects.toMatchObject({
      code: ImportErrorCode.UnknownFormat,
    });
  });
});

describe('readMusicFile', () => {
  it('names a song without a title after its file', async () => {
    const file = new File([utf8(SCORE)], 'My Song.musicxml');
    expect((await readMusicFile(file)).title).toBe('My Song');
  });

  it('refuses very large files', async () => {
    const huge = { name: 'huge.mid', size: MAX_IMPORT_BYTES + 1 } as File;
    await expect(readMusicFile(huge)).rejects.toMatchObject({ code: ImportErrorCode.TooLarge });
  });
});
