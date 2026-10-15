/** Clicking or touching the on-screen keyboard (PLAN.md §5.5). */
import { HeldNotes } from '../bus';
import { InputSource } from '../types';

const SCREEN_VELOCITY = 96;
const held = new HeldNotes(InputSource.Screen);

export function screenKeyDown(pitch: number, time: number): void {
  held.on(pitch, SCREEN_VELOCITY, time);
}

export function screenKeyUp(pitch: number, time: number): void {
  held.off(pitch, time);
}
