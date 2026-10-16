/**
 * Ear training (PLAN.md milestone 4.4): the level chosen last, to start with next time. Kept
 * in the settings table (key `earTraining`).
 */
import { create } from 'zustand';
import type { EarLevel } from '../content/earTraining';
import { db } from './db';

const KEY = 'earTraining';

export const useEarTraining = create<{ level: EarLevel | null }>(() => ({ level: null }));

export async function loadEarTraining(): Promise<void> {
  try {
    const row = await db.settings.get(KEY);
    const saved = row?.value as { level?: EarLevel } | undefined;
    useEarTraining.setState({ level: saved?.level ?? null });
  } catch (error) {
    console.error('Could not load ear training', error);
  }
}

export function chooseEarLevel(level: EarLevel): void {
  if (useEarTraining.getState().level === level) return;
  useEarTraining.setState({ level });
  db.settings.put({ key: KEY, value: { level } }).catch((error: unknown) => {
    console.error('Could not save ear training', error);
  });
}
