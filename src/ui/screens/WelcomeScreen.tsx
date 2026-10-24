import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../../appName';
import { Course } from '../../content/courses';
import { noteName, NamingSystem } from '../../i18n/naming';
import { updateSettings } from '../../storage/settings';
import { pitchesOf } from '../../theory/pitch';
import { Choice } from '../components/Choice';
import { InputSettings } from './settings/InputSettings';
import { LanguageSettings } from './settings/LanguageSettings';
import { LiveTest } from './settings/LiveTest';
import { MicSettings } from './settings/MicSettings';
import { MidiSettings } from './settings/MidiSettings';
import { VoiceSettings } from './settings/VoiceSettings';

/** What the learner wants to learn, asked first: the setup that follows fits it. */
const Learning = {
  Piano: 'piano',
  Voice: 'voice',
  Both: 'both',
} as const;
type Learning = (typeof Learning)[keyof typeof Learning];
const LEARNING: readonly Learning[] = Object.values(Learning);

/** The piano needs an instrument to listen to; the voice, the microphone and its range. */
const STEPS = {
  [Learning.Piano]: ['language', 'course', 'instrument', 'test'],
  [Learning.Voice]: ['language', 'course', 'microphone', 'range'],
  [Learning.Both]: ['language', 'course', 'instrument', 'test', 'range'],
} as const satisfies Record<Learning, readonly string[]>;
type WelcomeStep = (typeof STEPS)[Learning][number];
const EXAMPLE = pitchesOf('C4', 'D4', 'E4');
const example = (system: typeof NamingSystem.English | typeof NamingSystem.Solfege) =>
  EXAMPLE.map((pitch) => noteName(pitch, system)).join(' ');

/**
 * First launch: pick the language and note names, then piano, voice or both; connect an
 * instrument and try a key for the piano, the microphone and the range test for the voice.
 */
export function WelcomeScreen() {
  const { t } = useTranslation('screens');
  const [index, setIndex] = useState(0);
  const [learning, setLearning] = useState<Learning>(Learning.Piano);
  const steps: readonly WelcomeStep[] = STEPS[learning];
  const step = steps[index]!;
  const finish = () => updateSettings({ firstLaunchDone: true });
  const choose = (choice: Learning) => {
    setLearning(choice);
    // Both start with the piano; the switch in the top bar changes it.
    updateSettings({ course: choice === Learning.Voice ? Course.Voice : Course.Piano });
  };

  return (
    <section className="screen welcome">
      <h1>{t('welcome.title', { app: APP_NAME })}</h1>
      <p className="muted">{t('welcome.step', { current: index + 1, total: steps.length })}</p>
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
        {step === 'course' && (
          <div className="card">
            <Choice
              label={t('welcome.course.heading')}
              options={LEARNING}
              value={learning}
              nameOf={(choice) => t(`welcome.course.${choice}`)}
              onChange={choose}
            />
          </div>
        )}
        {step === 'microphone' && <MicSettings />}
        {step === 'range' && <VoiceSettings />}
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
          {index < steps.length - 1 ? (
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
