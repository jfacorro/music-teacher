import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand } from '../../../engine/score';
import { closestVoiceType, HeldNote, type VocalRange } from '../../../engine/vocalRange';
import { formatDate, formatNumber } from '../../../i18n/format';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { MicStatus, startMic, stopMic, useMic } from '../../../input/mic/micInput';
import { updateSettings, useSettings } from '../../../storage/settings';
import { pitchFromMidi } from '../../../theory/pitch';
import { keyboardLayout } from '../../keyboard/layout';
import { type ExpectedKey, PianoKeyboard } from '../../keyboard/PianoKeyboard';
import { KeyLabels } from '../../keyboard/styles';

/** The keyboard shown: from a low bass to a high soprano (E2–C6). */
const LOWEST_KEY = 40;
const HIGHEST_KEY = 84;

const Step = {
  Comfortable: 'comfortable',
  Lowest: 'lowest',
  Highest: 'highest',
} as const;
type Step = (typeof Step)[keyof typeof Step];

/** A test under way: the notes held so far (MIDI numbers). */
interface Test {
  step: Step;
  comfortable: number | null;
  low: number | null;
  high: number | null;
}

const START: Test = { step: Step.Comfortable, comfortable: null, low: null, high: null };

const keysBetween = (low: number | null, high: number | null) =>
  new Set(
    low === null || high === null ? [] : Array.from({ length: high - low + 1 }, (_, i) => low + i),
  );

/**
 * The vocal range test: a comfortable note, then the lowest and highest held steadily, sung to
 * the microphone. Only the latest result is kept.
 */
export function VoiceSettings() {
  const { t, i18n } = useTranslation('screens');
  const names = useNoteNames();
  const range = useSettings((s) => s.vocalRange);
  const echoCancellation = useSettings((s) => s.micEchoCancellation);
  const headphones = useSettings((s) => s.headphones);
  const micStatus = useMic((s) => s.status);
  const [test, setTest] = useState<Test | null>(null);
  const [live, setLive] = useState<{ note: number | null; held: number }>({ note: null, held: 0 });
  /** The test turned the microphone on, so it turns it off again. */
  const startedMic = useRef(false);
  const layout = useMemo(() => keyboardLayout(LOWEST_KEY, HIGHEST_KEY), []);
  const noteName = (midi: number) => names.name(pitchFromMidi(midi), { octave: true });

  const finish = () => {
    if (startedMic.current) stopMic();
    startedMic.current = false;
    setTest(null);
    setLive({ note: null, held: 0 });
  };

  const begin = async () => {
    setTest(START);
    if (useMic.getState().status !== MicStatus.On) {
      startedMic.current = true;
      await startMic(useSettings.getState().micDeviceId);
    }
  };

  // While testing, follow the note being sung; a note held steadily counts for the step.
  const testing = test !== null;
  useEffect(() => {
    if (!testing) return;
    const held = new HeldNote();
    return useMic.subscribe(({ reading }) => {
      const now = held.update(reading?.midi ?? null, performance.now());
      setLive(now);
      const note = now.note;
      if (note === null || now.held < 1) return;
      setTest((current) => {
        if (!current) return current;
        if (current.step === Step.Comfortable) {
          return { step: Step.Lowest, comfortable: note, low: note, high: note };
        }
        if (current.step === Step.Lowest && current.low !== null && note < current.low) {
          return { ...current, low: note };
        }
        if (current.step === Step.Highest && current.high !== null && note > current.high) {
          return { ...current, high: note };
        }
        return current;
      });
    });
  }, [testing]);

  // Leaving Settings in the middle of a test lets the microphone go.
  useEffect(
    () => () => {
      if (startedMic.current) stopMic();
    },
    [],
  );

  const save = () => {
    if (!test || test.comfortable === null || test.low === null || test.high === null) return;
    const result: VocalRange = {
      low: test.low,
      high: test.high,
      comfortable: test.comfortable,
      testedAt: Date.now(),
    };
    updateSettings({ vocalRange: result });
    finish();
  };

  const shown = test ?? range;
  const comfortable = shown?.comfortable ?? null;
  const expected = new Map<number, ExpectedKey>(
    comfortable === null ? [] : [[comfortable, { hand: Hand.Right }]],
  );
  const keyboard = shown && (
    <PianoKeyboard
      layout={layout}
      pressed={new Set(test && live.note !== null ? [live.note] : [])}
      expected={expected}
      completed={keysBetween(shown.low, shown.high)}
      labels={KeyLabels.C}
      labelFor={noteName}
    />
  );

  return (
    <section className="card voice-range">
      <h2>{t('settings.voice.heading')}</h2>
      {test === null && range === null && <p className="muted">{t('settings.voice.intro')}</p>}

      {test === null && range !== null && (
        <>
          <p className="voice-range__result">
            {t('settings.voice.result', { low: noteName(range.low), high: noteName(range.high) })}{' '}
            <span className="muted">
              {t('settings.voice.span', {
                semitones: range.high - range.low,
                octaves: formatNumber(
                  Math.round((range.high - range.low) / 1.2) / 10,
                  i18n.language,
                ),
              })}
            </span>
          </p>
          {keyboard}
          <p>
            {t('settings.voice.comfortable', { note: noteName(range.comfortable) })}
            {' · '}
            {t('settings.voice.voiceType', {
              type: t(`settings.voice.types.${closestVoiceType(range.low, range.high)}`),
            })}{' '}
            <span className="muted">{t('settings.voice.voiceTypeNote')}</span>
          </p>
          <p className="muted">
            {t('settings.voice.tested', {
              date: formatDate(new Date(range.testedAt), i18n.language),
            })}
          </p>
        </>
      )}

      {test !== null && (
        <>
          <ol className="voice-range__steps">
            <li className={test.comfortable === null ? 'is-current' : 'is-done'}>
              {test.comfortable === null
                ? t('settings.voice.steps.comfortable')
                : t('settings.voice.steps.comfortableFound', { note: noteName(test.comfortable) })}
            </li>
            <li className={test.step === Step.Lowest ? 'is-current' : ''}>
              {t('settings.voice.steps.lowest')}
            </li>
            <li className={test.step === Step.Highest ? 'is-current' : ''}>
              {t('settings.voice.steps.highest')}
            </li>
          </ol>
          <div className="voice-range__live">
            <div className="voice-range__note" role="status">
              <span className="muted">
                {live.note === null ? t('settings.voice.listening') : t('settings.voice.singing')}
              </span>
              <strong>{live.note === null ? '—' : noteName(live.note)}</strong>
              <span className="hold-bar">
                <span style={{ inlineSize: `${Math.round(live.held * 100)}%` }} />
              </span>
            </div>
            <div>
              <p>{t(`settings.voice.help.${test.step}`)}</p>
              <p className="muted">{t('settings.voice.dontPush')}</p>
            </div>
          </div>
          {keyboard}
          {micStatus === MicStatus.Denied && (
            <p className="notice notice--problem">{t('settings.voice.micDenied')}</p>
          )}
          {(micStatus === MicStatus.Unsupported || micStatus === MicStatus.Error) && (
            <p className="notice notice--problem">{t('settings.voice.micUnavailable')}</p>
          )}
        </>
      )}

      <div className="button-row">
        {test === null && (
          <button type="button" className="button button--primary" onClick={() => void begin()}>
            {range === null ? t('settings.voice.find') : t('settings.voice.testAgain')}
          </button>
        )}
        {test?.step === Step.Lowest && (
          <button
            type="button"
            className="button button--primary"
            onClick={() => setTest({ ...test, step: Step.Highest })}
          >
            {t('settings.voice.thatsLowest')}
          </button>
        )}
        {test?.step === Step.Highest && (
          <button type="button" className="button button--primary" onClick={save}>
            {t('settings.voice.thatsHighest')}
          </button>
        )}
        {test !== null && (
          <>
            <button type="button" className="button" onClick={() => setTest(START)}>
              {t('settings.voice.startOver')}
            </button>
            <button type="button" className="button" onClick={finish}>
              {t('settings.voice.cancel')}
            </button>
          </>
        )}
      </div>
      <h3>{t('settings.voice.speakers.heading')}</h3>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={headphones}
          onChange={(e) => updateSettings({ headphones: e.target.checked })}
        />
        {t('settings.voice.speakers.headphones')}
      </label>
      <p className="muted">{t('settings.voice.speakers.headphonesHelp')}</p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={echoCancellation}
          onChange={(e) => updateSettings({ micEchoCancellation: e.target.checked })}
        />
        {t('settings.voice.speakers.echoCancellation')}
      </label>
      <p className="muted">{t('settings.voice.speakers.help')}</p>
    </section>
  );
}
