/**
 * Reads a song file chosen by the learner: MIDI, MusicXML or compressed MusicXML, told apart
 * by their content (not the file name). The parsers load only when a file is imported.
 */
import { type ImportedMusic, ImportError, ImportErrorCode } from './importedMusic';

/** For the file picker. */
export const IMPORT_FILE_TYPES = '.mid,.midi,.musicxml,.xml,.mxl';
/** Far more than any piano piece needs. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/** Reads a file; without a title of its own, the song is named after the file. */
export async function readMusicFile(file: File): Promise<ImportedMusic> {
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError(ImportErrorCode.TooLarge);
  const music = await parseMusicBytes(new Uint8Array(await file.arrayBuffer()));
  return { ...music, title: music.title ?? (file.name.replace(/\.[^.]+$/, '') || null) };
}

export async function parseMusicBytes(bytes: Uint8Array): Promise<ImportedMusic> {
  if (startsWith(bytes, 'MThd')) {
    const { parseMidiFile } = await import('./midiFile');
    return parseMidiFile(bytes);
  }
  const { decodeText, unzipMxl } = await import('./mxl');
  const { parseMusicXml } = await import('./musicXmlFile');
  if (startsWith(bytes, 'PK\u0003\u0004')) return parseMusicXml(await unzipMxl(bytes));
  // TextDecoder drops a byte order mark, and trimStart() would too.
  const text = decodeText(bytes);
  if (text.trimStart().startsWith('<')) return parseMusicXml(text);
  throw new ImportError(ImportErrorCode.UnknownFormat);
}

function startsWith(bytes: Uint8Array, signature: string): boolean {
  return [...signature].every((char, i) => bytes[i] === char.charCodeAt(0));
}
