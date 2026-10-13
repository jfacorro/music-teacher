import { useTranslation } from 'react-i18next';
import {
  DEV_OCTAVE_MAX,
  DEV_OCTAVE_MIN,
  setDevOctave,
  useDevInput,
} from '../../../input/dev/devInput';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { setDevKeyboardPreference } from '../../../preferences';
import { updateSettings, useSettings } from '../../../storage/settings';
import { MIDDLE_C, pitchFromMidi } from '../../../theory/pitch';

const MINUS_SIGN = '−';

export function DevKeyboardSettings() {
  const { t } = useTranslation('screens');
  const enabled = useDevInput((s) => s.enabled);
  const octave = useDevInput((s) => s.octave);
  const keySound = useSettings((s) => s.keySound);
  const names = useNoteNames();

  return (
    <section className="card">
      <h2>{t('settings.devKeyboard.heading')}</h2>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setDevKeyboardPreference(e.target.checked)}
        />
        {t('settings.devKeyboard.enable')}
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={keySound}
          onChange={(e) => updateSettings({ keySound: e.target.checked })}
        />
        {t('settings.devKeyboard.sound')}
      </label>
      {enabled && (
        <>
          <p className="muted">
            {t('settings.devKeyboard.help', {
              note: names.name(pitchFromMidi(MIDDLE_C), { octave: false }),
            })}
          </p>
          <div className="octave-control">
            <button
              type="button"
              className="button"
              aria-label={t('settings.devKeyboard.octaveDown')}
              disabled={octave <= DEV_OCTAVE_MIN}
              onClick={() => setDevOctave(octave - 1)}
            >
              {MINUS_SIGN}
            </button>
            <span>{t('settings.devKeyboard.octave', { octave })}</span>
            <button
              type="button"
              className="button"
              aria-label={t('settings.devKeyboard.octaveUp')}
              disabled={octave >= DEV_OCTAVE_MAX}
              onClick={() => setDevOctave(octave + 1)}
            >
              +
            </button>
          </div>
        </>
      )}
    </section>
  );
}
