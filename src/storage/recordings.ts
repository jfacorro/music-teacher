/**
 * The latest finished run of each song and lesson exercise (PLAN.md milestone 4.2), kept to
 * listen to and compare with the music later; each new one replaces the last.
 */
import type { Recording } from '../engine/recording';
import { db } from './db';

export async function saveRecording(key: string, recording: Recording, now = Date.now()) {
  try {
    await db.recordings.put({ key, recordedAt: now, recording });
  } catch (error) {
    console.error('Could not save the recording', error);
  }
}

/** Drops the kept recordings whose key starts with `prefix`, except `key` (e.g. old drills). */
export async function dropRecordings(prefix: string, key: string) {
  try {
    await db.recordings
      .where('key')
      .startsWith(prefix)
      .and((row) => row.key !== key)
      .delete();
  } catch (error) {
    console.error('Could not drop old recordings', error);
  }
}

export async function loadRecording(key: string): Promise<Recording | null> {
  try {
    return (await db.recordings.get(key))?.recording ?? null;
  } catch (error) {
    console.error('Could not load the recording', error);
    return null;
  }
}
