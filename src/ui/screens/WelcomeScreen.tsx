import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { noteName, NamingSystem } from '../../i18n/naming';
import { updateSettings } from '../../storage/settings';
import { pitchesOf } from '../../theory/pitch';
import { InputSettings } from './settings/InputSettings';
import { LanguageSettings } from './settings/LanguageSettings';
import { LiveTest } from './settings/LiveTest';
import { MicSettings } from './settings/MicSettings';
import { MidiSettings } from './settings/MidiSettings';

const STEPS = ['language', 'instrument', 'test'] as const;
const EXAMPLE = pitchesOf('C4', 'D4', 'E4');
const example = (system: typeof NamingSystem.English | typeof NamingSystem.Solfege) =>
  EXAMPLE.map((pitch) => noteName(pitch, system)).join(' ');

/** First launch: pick the language and note names, connect an instrument, try a key. */
export function WelcomeScreen() {
  const { t } = useTranslation('screens');
  const [index, setIndex] = useState(0);
  const step = STEPS[index]!;
  const finish = () => updateSettings({ firstLaunchDone: true });

  return (
    <section className="screen welcome">
      <h1>{t('welcome.title')}</h1>
      <p className="muted">{t('welcome.step', { current: index + 1, total: STEPS.length })}</p>
      <h2>{t(`welcome.${step}.heading`)}</h2>
      <p>
        {step === 'language'
          ? t('welcome.language.intro', {
              letters: example(NamingSystem.English),
              solfege: example(NamingSystem.Solfege),
            })
          : t(`welcome.${step}.intro`)}
      </p>

      <div className="settings-grid">
        {step === 'language' && <LanguageSettings />}
        {step === 'instrument' && (
          <>
            <InputSettings />
            <MidiSettings />
            <MicSettings />
          </>
        )}
        {step === 'test' && <LiveTest />}
      </div>

      <nav className="lesson__nav">
        <button type="button" className="button button--quiet" onClick={finish}>
          {t('welcome.skip')}
        </button>
        <div className="button-row">
          {index > 0 && (
            <button type="button" className="button" onClick={() => setIndex(index - 1)}>
              {t('lesson.back')}
            </button>
          )}
          {index < STEPS.length - 1 ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => setIndex(index + 1)}
            >
              {t('lesson.continue')}
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={finish}>
              {t('welcome.start')}
            </button>
          )}
        </div>
      </nav>
    </section>
  );
}
