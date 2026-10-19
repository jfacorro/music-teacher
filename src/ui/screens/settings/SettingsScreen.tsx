import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { DevKeyboardSettings } from './DevKeyboardSettings';
import { InputSettings } from './InputSettings';
import { LanguageSettings } from './LanguageSettings';
import { LiveTest } from './LiveTest';
import { MicCheck } from './MicCheck';
import { MicSettings } from './MicSettings';
import { MidiSettings } from './MidiSettings';
import { SoundSettings } from './SoundSettings';
import { VoiceSettings } from './VoiceSettings';

export function SettingsScreen() {
  const { t } = useTranslation('screens');
  const { hash } = useLocation();
  // A link to a card ("/settings#sound") shows it.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);
  return (
    <section className="screen">
      <h1>{t('settings.title')}</h1>
      <div className="settings-list">
        <InputSettings />
        <LiveTest />
        <MidiSettings />
        <MicSettings />
        <MicCheck />
        <SoundSettings />
        <VoiceSettings />
        <AppearanceSettings />
        <DevKeyboardSettings />
        <LanguageSettings />
        <DataSettings />
      </div>
    </section>
  );
}
