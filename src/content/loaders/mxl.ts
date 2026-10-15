/**
 * Compressed MusicXML (.mxl): a ZIP archive whose `META-INF/container.xml` names the score
 * file inside. Read with the browser's own decompression, so no ZIP library is needed.
 */
import { ImportError, ImportErrorCode } from './importedMusic';

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;
const CONTAINER = 'META-INF/container.xml';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/** The MusicXML text inside an .mxl file. */
export async function unzipMxl(bytes: Uint8Array): Promise<string> {
  const entries = readDirectory(bytes);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  const container = byName.get(CONTAINER);
  const rootPath = container
    ? /full-path="([^"]+)"/.exec(decodeText(await extract(bytes, container)))?.[1]
    : undefined;
  const score =
    (rootPath && byName.get(rootPath)) ||
    entries.find(
      (entry) => !entry.name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(entry.name),
    );
  if (!score) throw new ImportError(ImportErrorCode.Unreadable, 'no score in the archive');
  return decodeText(await extract(bytes, score));
}

/** Text in UTF-8, or UTF-16 when it starts with a byte order mark. */
export function decodeText(bytes: Uint8Array): string {
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? 'utf-16be'
        : 'utf-8';
  return new TextDecoder(encoding).decode(bytes);
}

function readDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end record is last, followed only by a comment of up to 64 KB.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (view.getUint32(at, true) === END_OF_DIRECTORY) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new ImportError(ImportErrorCode.Unreadable, 'not a ZIP archive');

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== DIRECTORY_ENTRY) {
      throw new ImportError(ImportErrorCode.Unreadable, 'damaged ZIP directory');
    }
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    entries.push({
      name: new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      localHeaderOffset: view.getUint32(at + 42, true),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function extract(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localHeaderOffset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== LOCAL_HEADER) {
    throw new ImportError(ImportErrorCode.Unreadable, `damaged entry ${entry.name}`);
  }
  const dataStart = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = bytes.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === STORED) return data;
  if (entry.method !== DEFLATED) {
    throw new ImportError(ImportErrorCode.Unreadable, `compression method ${entry.method}`);
  }
  try {
    const stream = new Response(data.slice()).body!.pipeThrough(
      new DecompressionStream('deflate-raw'),
    );
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (error) {
    throw new ImportError(ImportErrorCode.Unreadable, String(error));
  }
}
