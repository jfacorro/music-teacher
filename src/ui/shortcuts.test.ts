// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { registerShortcut, ShortcutKey } from './shortcuts';

const press = (code: string, init: KeyboardEventInit = {}, target: EventTarget = window) => {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('shortcuts', () => {
  it('runs the latest shown for a key, and the one before once it goes', () => {
    const runs: string[] = [];
    const removeLesson = registerShortcut(ShortcutKey.Enter, () => runs.push('lesson'));
    const removeDialog = registerShortcut(ShortcutKey.Enter, () => runs.push('dialog'));
    expect(press('Enter').defaultPrevented).toBe(true);
    removeDialog();
    press('NumpadEnter');
    removeLesson();
    expect(press('Enter').defaultPrevented).toBe(false);
    expect(runs).toEqual(['dialog', 'lesson']);
  });

  it('comes before the page’s own listener for the key', () => {
    const runs: string[] = [];
    const page = () => runs.push('play');
    window.addEventListener('keydown', page);
    const remove = registerShortcut(ShortcutKey.Space, () => runs.push('try again'));
    press('Space');
    remove();
    press('Space');
    window.removeEventListener('keydown', page);
    expect(runs).toEqual(['try again', 'play']);
  });

  it('goes back with Backspace, but not while typing', () => {
    const runs: string[] = [];
    const remove = registerShortcut(ShortcutKey.Backspace, () => runs.push('back'));
    press('Backspace');
    const field = document.body.appendChild(document.createElement('textarea'));
    expect(press('Backspace', {}, field).defaultPrevented).toBe(false);
    remove();
    expect(runs).toEqual(['back']);
  });

  it('leaves held keys, other keys, modifiers and text fields alone', () => {
    const runs: string[] = [];
    const remove = registerShortcut(ShortcutKey.Space, () => runs.push('space'));
    press('Space', { repeat: true });
    press('Space', { ctrlKey: true });
    press('KeyA');
    const field = document.body.appendChild(document.createElement('input'));
    press('Space', {}, field);
    remove();
    expect(runs).toEqual([]);
  });
});
