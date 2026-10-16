/**
 * Appearance (PLAN.md milestone 4.5): light or dark colors, and the size of the on-screen
 * keyboard, chosen in Settings and applied in every view.
 */
import { ColorScheme, setColorScheme } from './canvas';

export const Theme = {
  /** Follows the computer's setting. */
  System: 'system',
  Light: 'light',
  Dark: 'dark',
} as const;
export type Theme = (typeof Theme)[keyof typeof Theme];

export const KeyHeight = {
  Short: 'short',
  Normal: 'normal',
  Tall: 'tall',
} as const;
export type KeyHeight = (typeof KeyHeight)[keyof typeof KeyHeight];

export const KeysShown = {
  /** Whole octaves around the music, at least two. */
  Fit: 'fit',
  /** At least four octaves around the music. */
  Wider: 'wider',
  /** All 88 keys. */
  Piano: 'piano',
} as const;
export type KeysShown = (typeof KeysShown)[keyof typeof KeysShown];

/** A white key's height for its width. */
export const KEY_ASPECTS: Readonly<Record<KeyHeight, number>> = {
  [KeyHeight.Short]: 4,
  [KeyHeight.Normal]: 5,
  [KeyHeight.Tall]: 6.5,
};

/**
 * A copy of the theme in this browser's storage, so index.html can set it before the app has
 * loaded its settings (no flash of the wrong colors).
 */
const FIRST_PAINT_KEY = 'piano-teacher:theme';

let stopFollowingSystem: (() => void) | null = null;

/** Shows the theme everywhere: the page, canvases, and the desktop app's window. */
export function applyTheme(theme: Theme): void {
  stopFollowingSystem?.();
  stopFollowingSystem = null;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const dark = theme === Theme.Dark || (theme === Theme.System && media.matches);
    const scheme = dark ? ColorScheme.Dark : ColorScheme.Light;
    document.documentElement.dataset.theme = scheme;
    setColorScheme(scheme);
  };
  apply();
  if (theme === Theme.System) {
    media.addEventListener('change', apply);
    stopFollowingSystem = () => media.removeEventListener('change', apply);
  }
  try {
    localStorage.setItem(FIRST_PAINT_KEY, theme);
  } catch {
    // Only the first paint is slower to pick it up.
  }
  window.desktop?.setTheme?.(theme);
}
