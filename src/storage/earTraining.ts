/**
 * Ear training (PLAN.md milestone 4.4): the level chosen last, to start with next time,
 * whether single notes come after middle C, and whether all 12 notes are asked. Kept in the
 * settings table (key `earTraining`).
 */
import { create } from 'zustand';
import type { EarLevel } from '../content/earTraining';
import { db } from './db';

const KEY = 'earTraining';

export interface EarTrainingState {
  level: EarLevel | null;
  /** Single notes come after middle C, as a reference. */
  reference: boolean;
  /** Single notes and intervals use all 12 notes, not only those the course has reached. */
  allNotes: boolean;
}

export const useEarTraining = create<EarTrainingState>(() => ({
  level: null,
  reference: true,
  allNotes: false,
}));

export async function loadEarTraining(): Promise<void> {
  try {
    const row = await db.settings.get(KEY);
    const saved = row?.value as Partial<EarTrainingState> | undefined;
    useEarTraining.setState({
      level: saved?.level ?? null,
      reference: saved?.reference ?? true,
      allNotes: saved?.allNotes ?? false,
    });
  } catch (error) {
    console.error('Could not load ear training', error);
  }
}

function save(patch: Partial<EarTrainingState>): void {
  useEarTraining.setState(patch);
  db.settings.put({ key: KEY, value: useEarTraining.getState() }).catch((error: unknown) => {
    console.error('Could not save ear training', error);
  });
}

export function chooseEarLevel(level: EarLevel): void {
  if (useEarTraining.getState().level !== level) save({ level });
}

export function setEarReference(reference: boolean): void {
  save({ reference });
}

export function setEarAllNotes(allNotes: boolean): void {
  save({ allNotes });
}
