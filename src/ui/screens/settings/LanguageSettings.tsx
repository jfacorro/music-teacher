import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, detectLanguage, languageDisplayName } from '../../../i18n/languages';
import {
  NAMING_SYSTEMS,
  defaultNamingSystem,
  noteName,
  type NamingSystem,
} from '../../../i18n/naming';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { setLanguagePreference } from '../../../preferences';
import { updateSettings, useSettings } from '../../../storage/settings';
import { pitchesOf } from '../../../theory/pitch';
import { SHEET_NOTATIONS, type SheetNotation } from '../../../content/lessons';

const AUTO = 'auto';
const SCALE = pitchesOf('C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4');
const PREVIEW = pitchesOf('C4', 'F#4', 'Bb4', 'B4');

const scaleExample = (system: NamingSystem) =>
  SCALE.map((pitch) => noteName(pitch, system)).join(' ');

export function LanguageSettings() {
  const { t, i18n } = useTranslation('screens');
  const language = useSettings((s) => s.language);
  const namingSystem = useSettings((s) => s.namingSystem);
  const showOctave = useSettings((s) => s.showOctave);
  const sheetNotation = useSettings((s) => s.sheetNotation);
  const notationId = useId();
  const names = useNoteNames();
  const languageId = useId();
  const namingId = useId();

  const detected = detectLanguage(navigator.languages);

  return (
    <section className="card">
      <h2>{t('settings.language.heading')}</h2>

      <div className="field">
        <label htmlFor={languageId}>{t('settings.language.language')}</label>
        <select
          id={languageId}
          value={language ?? AUTO}
          onChange={(e) => setLanguagePreference(e.target.value === AUTO ? null : e.target.value)}
        >
          <option value={AUTO}>
            {t('settings.language.auto', { language: languageDisplayName(detected) })}
          </option>
          {LANGUAGES.map((lng) => (
            <option key={lng} value={lng} lang={lng}>
              {languageDisplayName(lng)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={namingId}>{t('settings.language.namingSystem')}</label>
        <select
          id={namingId}
          value={namingSystem ?? AUTO}
          onChange={(e) =>
            updateSettings({
              namingSystem: e.target.value === AUTO ? null : (e.target.value as NamingSystem),
            })
          }
        >
          <option value={AUTO}>
            {t('settings.language.namingAuto', {
              example: scaleExample(defaultNamingSystem(i18n.language)),
            })}
          </option>
          {NAMING_SYSTEMS.map((system) => (
            <option key={system} value={system}>
              {t('settings.language.namingOption', {
                name: t(`settings.language.naming.${system}`),
                example: scaleExample(system),
              })}
            </option>
          ))}
        </select>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={showOctave}
          onChange={(e) => updateSettings({ showOctave: e.target.checked })}
        />
        {t('settings.language.showOctave')}
      </label>

      <p className="muted">
        {t('settings.language.preview', {
          notes: PREVIEW.map((pitch) => names.name(pitch)).join(', '),
        })}
      </p>

      <div className="field">
        <label htmlFor={notationId}>{t('settings.language.sheetNotation')}</label>
        <select
          id={notationId}
          value={sheetNotation}
          onChange={(e) => updateSettings({ sheetNotation: e.target.value as SheetNotation })}
        >
          {SHEET_NOTATIONS.map((value) => (
            <option key={value} value={value}>
              {t(`practice.notation.${value}`)}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
