/** User preference changes that touch more than the stored settings. */
import { changeLanguage } from './i18n';
import { detectLanguage } from './i18n/languages';
import { setDevInputEnabled } from './input/dev/devInput';
import { updateSettings } from './storage/settings';

/** `null` follows the browser's language. */
export function setLanguagePreference(language: string | null): void {
  updateSettings({ language });
  void changeLanguage(language ?? detectLanguage(navigator.languages));
}

export function setDevKeyboardPreference(enabled: boolean): void {
  updateSettings({ devKeyboard: enabled });
  setDevInputEnabled(enabled);
}
