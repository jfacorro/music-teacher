/**
 * Key shortcuts for buttons: Space tries again, Enter continues, Backspace goes back a lesson
 * step (shown on the buttons as a key chip). Only buttons on screen answer to their key, and
 * when several are, the latest shown wins: a results dialog's Continue takes over from the
 * lesson's. They take the key before the page's own shortcuts (Space plays and pauses a run), and
 * never from a text field.
 */
import { useEffect, useRef } from 'react';
import { isTypingTarget } from '../input/dev/devInput';

export const ShortcutKey = {
  Space: 'Space',
  Enter: 'Enter',
  Backspace: 'Backspace',
} as const;
export type ShortcutKey = (typeof ShortcutKey)[keyof typeof ShortcutKey];

interface Entry {
  run: () => void;
}

const shown = new Map<ShortcutKey, Entry[]>();
let listening = false;

/** The key an event is for (the keypad's Enter too), if it's a shortcut's. */
function shortcutOf(event: KeyboardEvent): ShortcutKey | null {
  if (event.code === 'Space') return ShortcutKey.Space;
  if (event.code === 'Enter' || event.code === 'NumpadEnter') return ShortcutKey.Enter;
  if (event.code === 'Backspace') return ShortcutKey.Backspace;
  return null;
}

function onKeyDown(event: KeyboardEvent): void {
  const key = shortcutOf(event);
  const entry = key ? shown.get(key)?.at(-1) : undefined;
  if (!entry) return;
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  if (isTypingTarget(event.target)) return;
  // The shortcut, not the page's own use of the key, nor a focused button's (Space and Enter
  // would also press it).
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.target instanceof HTMLElement && event.target !== document.body) {
    event.target.blur();
  }
  entry.run();
}

/** From now on `key` runs `run`, ahead of what it ran before; returns how to undo it. */
export function registerShortcut(key: ShortcutKey, run: () => void): () => void {
  if (!listening) {
    // Captured on the window, so it comes before the page's own key listeners.
    window.addEventListener('keydown', onKeyDown, true);
    listening = true;
  }
  const entry: Entry = { run };
  shown.set(key, [...(shown.get(key) ?? []), entry]);
  return () =>
    shown.set(
      key,
      (shown.get(key) ?? []).filter((other) => other !== entry),
    );
}

/** While mounted (and `enabled`), `key` runs `action`. */
export function useShortcut(key: ShortcutKey, action: () => void, enabled = true): void {
  const latest = useRef(action);
  useEffect(() => {
    latest.current = action;
  });
  useEffect(() => {
    if (!enabled) return;
    return registerShortcut(key, () => latest.current());
  }, [key, enabled]);
}
