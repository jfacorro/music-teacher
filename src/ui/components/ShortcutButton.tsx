import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ShortcutKey, useShortcut } from '../shortcuts';

/** Each shortcut key's name, as shown on its buttons. */
const KEY_NAMES = {
  [ShortcutKey.Space]: 'practice.keys.space',
  [ShortcutKey.Enter]: 'practice.keys.enter',
  [ShortcutKey.Backspace]: 'practice.keys.backspace',
} as const;

/** A shortcut's key, in a small chip after a button's label. */
export function KeyHint({ shortcut }: { shortcut: ShortcutKey }) {
  const { t } = useTranslation('screens');
  return (
    <kbd className="key-hint" aria-hidden="true">
      {t(KEY_NAMES[shortcut])}
    </kbd>
  );
}

interface ShortcutButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'type'
> {
  /** The key that presses it, shown in a chip after its label. */
  shortcut: ShortcutKey;
  onClick: () => void;
  children: ReactNode;
}

/**
 * A button with a key shortcut (Space to try again, Enter to continue, Backspace to go back), its
 * key shown on it.
 */
export function ShortcutButton({
  shortcut,
  onClick,
  children,
  disabled,
  ...rest
}: ShortcutButtonProps) {
  useShortcut(shortcut, onClick, !disabled);
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      aria-keyshortcuts={shortcut}
      onClick={onClick}
    >
      {children}
      <KeyHint shortcut={shortcut} />
    </button>
  );
}
