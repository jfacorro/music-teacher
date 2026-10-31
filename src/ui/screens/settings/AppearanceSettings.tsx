import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand } from '../../../engine/score';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { setThemePreference } from '../../../preferences';
import { updateSettings, useSettings } from '../../../storage/settings';
import { pitchFromMidi } from '../../../theory/pitch';
import { KeyHeight, KeysShown, Theme } from '../../appearance';
import { Choice } from '../../components/Choice';
import { usePressedKeys } from '../../hooks';
import { keyboardLayout, keyboardRange } from '../../keyboard/layout';
import { type ExpectedKey, PianoKeyboard } from '../../keyboard/PianoKeyboard';
import { KeyLabels } from '../../keyboard/styles';
import { VIEW_CHOICES } from '../../viewChoice';
import { screenKeyDown, screenKeyUp } from '../../../input/dev/screenInput';

const THEMES: readonly Theme[] = [Theme.System, Theme.Light, Theme.Dark];
const KEY_HEIGHTS: readonly KeyHeight[] = [KeyHeight.Short, KeyHeight.Normal, KeyHeight.Tall];
const KEYS_SHOWN: readonly KeysShown[] = [KeysShown.Fit, KeysShown.Wider, KeysShown.Piano];
/** The preview's music: the right hand's first position. */
const PREVIEW_KEYS = [60, 62, 64, 65, 67];

/**
 * Theme, how exercises show the music, and keyboard size (PLAN.md milestone 4.5), with a keyboard
 * to see the result.
 */
export function AppearanceSettings() {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const theme = useSettings((s) => s.theme);
  const exerciseView = useSettings((s) => s.exerciseView);
  const keyHeight = useSettings((s) => s.keyHeight);
  const keysShown = useSettings((s) => s.keysShown);
  const pressed = usePressedKeys();
  const layout = useMemo(
    () => keyboardLayout(...keyboardRange(PREVIEW_KEYS, keysShown)),
    [keysShown],
  );
  const expected = useMemo(
    () => new Map<number, ExpectedKey>(PREVIEW_KEYS.map((key) => [key, { hand: Hand.Right }])),
    [],
  );

  return (
    <section className="card appearance">
      <h2>{t('settings.appearance.heading')}</h2>
      <div className="appearance__row">
        <span className="appearance__label">{t('settings.appearance.theme')}</span>
        <div>
          <Choice
            label={t('settings.appearance.theme')}
            options={THEMES}
            value={theme}
            nameOf={(option) => t(`settings.appearance.themes.${option}`)}
            onChange={setThemePreference}
          />
          <p className="muted appearance__hint">{t(`settings.appearance.themeHints.${theme}`)}</p>
        </div>
      </div>
      <div className="appearance__row">
        <span className="appearance__label">{t('settings.appearance.exerciseView')}</span>
        <div>
          <Choice
            label={t('settings.appearance.exerciseView')}
            options={VIEW_CHOICES}
            value={exerciseView}
            nameOf={(option) => t(`settings.appearance.exerciseViews.${option}`)}
            onChange={(option) => updateSettings({ exerciseView: option })}
          />
          <p className="muted appearance__hint">
            {t(`settings.appearance.exerciseViewHints.${exerciseView}`)}
          </p>
        </div>
      </div>
      <div className="appearance__row">
        <span className="appearance__label">{t('settings.appearance.keyHeight')}</span>
        <div>
          <Choice
            label={t('settings.appearance.keyHeight')}
            options={KEY_HEIGHTS}
            value={keyHeight}
            nameOf={(option) => t(`settings.appearance.keyHeights.${option}`)}
            onChange={(option) => updateSettings({ keyHeight: option })}
          />
          <p className="muted appearance__hint">
            {t(`settings.appearance.keyHeightHints.${keyHeight}`)}
          </p>
        </div>
      </div>
      <div className="appearance__row">
        <span className="appearance__label">{t('settings.appearance.keysShown')}</span>
        <div>
          <Choice
            label={t('settings.appearance.keysShown')}
            options={KEYS_SHOWN}
            value={keysShown}
            nameOf={(option) => t(`settings.appearance.keysShownOptions.${option}`)}
            onChange={(option) => updateSettings({ keysShown: option })}
          />
          <p className="muted appearance__hint">
            {t(`settings.appearance.keysShownHints.${keysShown}`)}
          </p>
        </div>
      </div>
      <p className="muted appearance__hint">{t('settings.appearance.preview')}</p>
      <PianoKeyboard
        layout={layout}
        pressed={pressed}
        expected={expected}
        labels={KeyLabels.White}
        labelFor={(midi) => names.name(pitchFromMidi(midi), { octave: false })}
        onKeyDown={screenKeyDown}
        onKeyUp={screenKeyUp}
      />
    </section>
  );
}
