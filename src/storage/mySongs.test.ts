import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ImportFormat, TrackHand } from '../content/loaders/importedMusic';
import { pitchOf } from '../theory/pitch';
import {
  addMySong,
  deleteMySong,
  getMySong,
  loadMySongs,
  type NewSong,
  updateMySong,
  useMySongs,
} from './mySongs';

const song = (title: string): NewSong => ({
  title,
  composer: null,
  fileName: `${title}.mid`,
  music: {
    format: ImportFormat.Midi,
    title,
    composer: null,
    tempo: 100,
    timeSignature: [4, 4],
    keyFifths: 0,
    tracks: [{ name: null, staff: null, notes: [{ pitch: pitchOf('C4'), start: 0, duration: 1 }] }],
    warnings: [],
  },
  options: { hands: [TrackHand.Right], transpose: 0, tempo: 100 },
});

describe('my songs', () => {
  it('keeps imported songs, newest first, and lets them be changed and removed', async () => {
    const first = await addMySong(song('First'), 1000);
    const second = await addMySong(song('Second'), 2000);
    expect(useMySongs.getState().songs.map((s) => s.title)).toEqual(['Second', 'First']);

    await updateMySong(first, {
      title: 'Renamed',
      composer: 'Someone',
      options: { hands: [TrackHand.Left], transpose: 2, tempo: 80 },
    });
    const saved = await getMySong(first);
    expect(saved?.title).toBe('Renamed');
    expect(saved?.options).toEqual({ hands: [TrackHand.Left], transpose: 2, tempo: 80 });
    expect(saved?.music.tracks[0]?.notes[0]?.pitch).toEqual(pitchOf('C4'));

    await deleteMySong(second);
    expect(await getMySong(second)).toBeUndefined();

    useMySongs.setState({ songs: [] });
    await loadMySongs();
    expect(useMySongs.getState().songs).toEqual([
      { id: first, title: 'Renamed', composer: 'Someone', addedAt: 1000 },
    ]);
  });
});
