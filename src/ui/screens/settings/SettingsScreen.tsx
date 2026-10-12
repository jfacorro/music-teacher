import { useTranslation } from 'react-i18next';
import { DevKeyboardSettings } from './DevKeyboardSettings';
import { LanguageSettings } from './LanguageSettings';
import { LiveTest } from './LiveTest';
import { MidiSettings } from './MidiSettings';

export function SettingsScreen() {
  const { t } = useTranslation('screens');
  return (
    <section className="screen">
      <h1>{t('settings.title')}</h1>
      <div className="settings-grid">
        <MidiSettings />
        <LiveTest />
        <DevKeyboardSettings />
        <LanguageSettings />
      </div>
    </section>
  );
}
