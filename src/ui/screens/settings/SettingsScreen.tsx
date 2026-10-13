import { useTranslation } from 'react-i18next';
import { DevKeyboardSettings } from './DevKeyboardSettings';
import { InputSettings } from './InputSettings';
import { LanguageSettings } from './LanguageSettings';
import { LiveTest } from './LiveTest';
import { MicCheck } from './MicCheck';
import { MicSettings } from './MicSettings';
import { MidiSettings } from './MidiSettings';
import { SoundSettings } from './SoundSettings';

export function SettingsScreen() {
  const { t } = useTranslation('screens');
  return (
    <section className="screen">
      <h1>{t('settings.title')}</h1>
      <div className="settings-grid">
        <InputSettings />
        <LiveTest />
        <MidiSettings />
        <MicSettings />
        <MicCheck />
        <SoundSettings />
        <DevKeyboardSettings />
        <LanguageSettings />
      </div>
    </section>
  );
}
