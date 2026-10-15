import { describe, expect, it } from 'vitest';
import { ImportErrorCode } from './importedMusic';
import { decodeText, unzipMxl } from './mxl';
import { utf16, utf8, zip } from './zipFixture';

const container = (path: string) =>
  utf8(
    '<?xml version="1.0"?><container><rootfiles>' +
      `<rootfile full-path="${path}" media-type="application/vnd.recordare.musicxml+xml"/>` +
      '</rootfiles></container>',
  );

describe('unzipMxl', () => {
  it('reads the score the container names, compressed or stored', async () => {
    const archive = await zip([
      { name: 'mimetype', data: utf8('application/vnd.recordare.musicxml') },
      { name: 'META-INF/container.xml', data: container('scores/song.musicxml'), compress: true },
      { name: 'other.xml', data: utf8('<other/>') },
      { name: 'scores/song.musicxml', data: utf8('<score-partwise/>'), compress: true },
    ]);
    expect(await unzipMxl(archive)).toBe('<score-partwise/>');
  });

  it('without a container, reads the first MusicXML file', async () => {
    const archive = await zip([
      { name: 'META-INF/manifest.xml', data: utf8('<manifest/>') },
      { name: 'song.xml', data: utf8('<score-partwise/>') },
    ]);
    expect(await unzipMxl(archive)).toBe('<score-partwise/>');
  });

  it('rejects archives without a score, and damaged ones', async () => {
    const empty = await zip([{ name: 'readme.txt', data: utf8('hello') }]);
    await expect(unzipMxl(empty)).rejects.toMatchObject({ code: ImportErrorCode.Unreadable });
    await expect(unzipMxl(utf8('PK\u0003\u0004 and then garbage'))).rejects.toMatchObject({
      code: ImportErrorCode.Unreadable,
    });
  });
});

describe('decodeText', () => {
  it('reads UTF-8, and UTF-16 with a byte order mark', () => {
    expect(decodeText(utf8('<a>é</a>'))).toBe('<a>é</a>');
    expect(decodeText(utf16('<a>é</a>'))).toBe('<a>é</a>');
  });
});
