/**
 * Sight-reading (PLAN.md milestone 4.3): the level chosen last, and the drills played lately,
 * so new ones are never the same; the same for sight-singing (milestone 6.5). Kept in the
 * settings table (key `sightReading`).
 */
import { create } from 'zustand';
import type { DrillLevel } from '../content/sightReading';
import type { SingDrillLevel } from '../content/sightSinging';
import { db } from './db';

/** Recent drills remembered per level. */
export const RECENT_DRILLS = 50;

export interface SightReadingState {
  level: DrillLevel | null;
  /** Seeds of the latest drills of each level, oldest first. */
  recent: Partial<Record<DrillLevel, number[]>>;
  /** Sight-singing's level chosen last, and its latest drills. */
  voiceLevel: SingDrillLevel | null;
  voiceRecent: Partial<Record<SingDrillLevel, number[]>>;
}

const KEY = 'sightReading';

export const useSightReading = create<SightReadingState>(() => ({
  level: null,
  recent: {},
  voiceLevel: null,
  voiceRecent: {},
}));

export async function loadSightReading(): Promise<void> {
  try {
    const row = await db.settings.get(KEY);
    const saved = row?.value as Partial<SightReadingState> | undefined;
    useSightReading.setState({
      level: saved?.level ?? null,
      recent: saved?.recent ?? {},
      voiceLevel: saved?.voiceLevel ?? null,
      voiceRecent: saved?.voiceRecent ?? {},
    });
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

/** A sight-singing drill shown, as `rememberDrill` for the piano. */
export function rememberSingDrill(voiceLevel: SingDrillLevel, seed: number): void {
  const { voiceRecent } = useSightReading.getState();
  const seeds = (voiceRecent[voiceLevel] ?? []).filter((other) => other !== seed);
  save({
    voiceLevel,
    voiceRecent: { ...voiceRecent, [voiceLevel]: [...seeds, seed].slice(-RECENT_DRILLS) },
  });
}
