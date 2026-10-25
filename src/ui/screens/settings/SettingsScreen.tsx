import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { IndexedPage } from '../../components/IndexedPage';
import { AppearanceSettings } from './AppearanceSettings';
import { DataSettings } from './DataSettings';
import { DeviceSettings } from './DeviceSettings';
import { DevKeyboardSettings } from './DevKeyboardSettings';
import { InputSettings } from './InputSettings';
import { LanguageSettings } from './LanguageSettings';
import { LiveTest } from './LiveTest';
import { MicCheck } from './MicCheck';
import { MicSettings } from './MicSettings';
import { MidiSettings } from './MidiSettings';
import { SoundSettings } from './SoundSettings';
import { VoiceSettings } from './VoiceSettings';

/** The cards, in groups; each card's id is where links ("/settings#sound") and the index go. */
const GROUPS = [
  {
    heading: 'settings.groups.keyboard',
    sections: [
      { id: 'input', heading: 'settings.input.heading', Card: InputSettings },
      { id: 'live-test', heading: 'settings.liveTest.heading', Card: LiveTest },
      { id: 'midi', heading: 'settings.midi.heading', Card: MidiSettings },
      { id: 'mic', heading: 'settings.mic.heading', Card: MicSettings },
      { id: 'mic-check', heading: 'settings.micCheck.heading', Card: MicCheck },
      {
        id: 'computer-keyboard',
        heading: 'settings.devKeyboard.heading',
        Card: DevKeyboardSettings,
      },
    ],
  },
  {
    heading: 'settings.groups.sound',
    sections: [
      { id: 'devices', heading: 'settings.devices.heading', Card: DeviceSettings },
      { id: 'sound', heading: 'settings.sound.heading', Card: SoundSettings },
      { id: 'voice', heading: 'settings.voice.heading', Card: VoiceSettings },
    ],
  },
  {
    heading: 'settings.groups.look',
    sections: [
      { id: 'appearance', heading: 'settings.appearance.heading', Card: AppearanceSettings },
      { id: 'language', heading: 'settings.language.heading', Card: LanguageSettings },
    ],
  },
  {
    heading: 'settings.groups.data',
    sections: [{ id: 'data', heading: 'settings.data.heading', Card: DataSettings }],
  },
] as const satisfies readonly {
  heading: string;
  sections: readonly { id: string; heading: string; Card: ComponentType }[];
}[];

export function SettingsScreen() {
  const { t } = useTranslation('screens');
  return (
    <section className="screen">
      <h1>{t('settings.title')}</h1>
      <IndexedPage
        groups={GROUPS.map((group) => ({
          heading: t(group.heading),
          items: group.sections.map((section) => ({ id: section.id, label: t(section.heading) })),
        }))}
      >
        <div className="settings-list">
          {GROUPS.map((group) => (
            <section key={group.heading} className="settings-group">
              <h2 className="settings-group__heading">{t(group.heading)}</h2>
              {group.sections.map(({ id, Card }) => (
                <div key={id} id={id}>
                  <Card />
                </div>
              ))}
            </section>
          ))}
        </div>
      </IndexedPage>
    </section>
  );
}
