/**
 * Ear training (PLAN.md milestone 4.4): the level chosen last, to start with next time,
 * whether single notes come after middle C, and whether all 12 notes are asked; for the voice
 * (milestone 6.4), its own level and whether questions are sung back or played on the keyboard.
 * Kept in the settings table (key `earTraining`).
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
  /** The voice's level chosen last. */
  voiceLevel: EarLevel | null;
  /** The voice answers by singing (or else on the keyboard). */
  singBack: boolean;
}

export const useEarTraining = create<EarTrainingState>(() => ({
  level: null,
  reference: true,
  allNotes: false,
  voiceLevel: null,
  singBack: true,
}));

export async function loadEarTraining(): Promise<void> {
  try {
    const row = await db.settings.get(KEY);
    const saved = row?.value as Partial<EarTrainingState> | undefined;
    useEarTraining.setState({
      level: saved?.level ?? null,
      reference: saved?.reference ?? true,
      allNotes: saved?.allNotes ?? false,
      voiceLevel: saved?.voiceLevel ?? null,
      singBack: saved?.singBack ?? true,
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

export function chooseVoiceEarLevel(voiceLevel: EarLevel): void {
  if (useEarTraining.getState().voiceLevel !== voiceLevel) save({ voiceLevel });
}

export function setEarSingBack(singBack: boolean): void {
  save({ singBack });
}
