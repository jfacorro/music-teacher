/**
 * Computer keyboard as a piano, for developing without the real one (PLAN.md §5.5).
 * Laid out like a DAW: the home row plays white keys, the row above plays black keys.
 * Uses physical key codes, so it works the same on any keyboard layout.
 */
import { create } from 'zustand';
import { PIANO_HIGHEST, PIANO_LOWEST } from '../../theory/pitch';
import { HeldNotes } from '../bus';

/** Physical key → semitones above the current octave's C. */
export const DEV_KEYS: Readonly<Record<string, number>> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8,
  KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16,
}; // prettier-ignore

export const OCTAVE_DOWN_KEY = 'KeyZ';
export const OCTAVE_UP_KEY = 'KeyX';
export const DEV_OCTAVE_MIN = 0;
export const DEV_OCTAVE_MAX = 7;
const DEV_VELOCITY = 96;

export function devKeyToPitch(code: string, octave: number): number | null {
  const offset = DEV_KEYS[code];
  if (offset === undefined) return null;
  const pitch = (octave + 1) * 12 + offset;
  return pitch >= PIANO_LOWEST && pitch <= PIANO_HIGHEST ? pitch : null;
}

export const useDevInput = create(() => ({ enabled: false, octave: 4 }));

const held = new HeldNotes('dev');
const pressed = new Map<string, number>(); // key code → pitch it started

export function setDevInputEnabled(enabled: boolean): void {
  if (enabled === useDevInput.getState().enabled) return;
  if (enabled) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
  } else {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', releaseAll);
    releaseAll();
  }
  useDevInput.setState({ enabled });
}

export function setDevOctave(octave: number): void {
  useDevInput.setState({ octave: Math.min(DEV_OCTAVE_MAX, Math.max(DEV_OCTAVE_MIN, octave)) });
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTypingTarget(event.target)) return;

  const { octave } = useDevInput.getState();
  if (event.code === OCTAVE_DOWN_KEY || event.code === OCTAVE_UP_KEY) {
    setDevOctave(octave + (event.code === OCTAVE_UP_KEY ? 1 : -1));
    event.preventDefault();
    return;
  }
  const pitch = devKeyToPitch(event.code, octave);
  if (pitch === null || pressed.has(event.code)) return;
  pressed.set(event.code, pitch);
  held.on(pitch, DEV_VELOCITY, event.timeStamp);
  event.preventDefault();
}

function onKeyUp(event: KeyboardEvent): void {
  const pitch = pressed.get(event.code);
  if (pitch === undefined) return;
  pressed.delete(event.code);
  held.off(pitch, event.timeStamp);
}

function releaseAll(): void {
  pressed.clear();
  held.releaseAll();
}

/** Don't steal keys from text fields or from selects (letters jump between options). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'range', 'submit', 'reset'].includes(target.type);
  }
  return false;
}
