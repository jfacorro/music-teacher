/**
 * Sight-reading (PLAN.md milestone 4.3): the level chosen last, and the drills played lately,
 * so new ones are never the same. Kept in the settings table (key `sightReading`).
 */
import { create } from 'zustand';
import type { DrillLevel } from '../content/sightReading';
import { db } from './db';

/** Recent drills remembered per level. */
export const RECENT_DRILLS = 50;

export interface SightReadingState {
  level: DrillLevel | null;
  /** Seeds of the latest drills of each level, oldest first. */
  recent: Partial<Record<DrillLevel, number[]>>;
}

const KEY = 'sightReading';

export const useSightReading = create<SightReadingState>(() => ({ level: null, recent: {} }));

export async function loadSightReading(): Promise<void> {
  try {
    const row = await db.settings.get(KEY);
    const saved = row?.value as Partial<SightReadingState> | undefined;
    useSightReading.setState({ level: saved?.level ?? null, recent: saved?.recent ?? {} });
  } catch (error) {
    console.error('Could not load sight-reading', error);
  }
}

function save(patch: Partial<SightReadingState>): void {
  useSightReading.setState(patch);
  db.settings.put({ key: KEY, value: useSightReading.getState() }).catch((error: unknown) => {
    console.error('Could not save sight-reading', error);
  });
}

/** A drill shown: its level becomes the one to start with, and it joins the recent ones. */
export function rememberDrill(level: DrillLevel, seed: number): void {
  const { recent } = useSightReading.getState();
  const seeds = (recent[level] ?? []).filter((other) => other !== seed);
  save({ level, recent: { ...recent, [level]: [...seeds, seed].slice(-RECENT_DRILLS) } });
}
