import { useTranslation } from 'react-i18next';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { useLiveInput } from '../../../input/liveStore';
import { pitchFromMidi } from '../../../theory/pitch';
import { HeldNotesDisplay } from '../../components/HeldNotesDisplay';

/** Shows every key as it's pressed: the checkpoint for "is the keyboard detected?". */
export function LiveTest() {
  const { t } = useTranslation('screens');
  const { t: tc } = useTranslation('common');
  const recent = useLiveInput((s) => s.recent);
  const names = useNoteNames();

  const label = (midi: number) => names.name(pitchFromMidi(midi), { octave: true });

  return (
    <section className="card live-test">
      <h2>{t('settings.liveTest.heading')}</h2>
      <p className="muted">{t('settings.liveTest.intro')}</p>

      <h3>{t('settings.liveTest.held')}</h3>
      <HeldNotesDisplay showVelocity />

      {recent.length > 0 && (
        <>
          <h3>{t('settings.liveTest.recent')}</h3>
          <table className="events">
            <thead>
              <tr>
                <th scope="col">{t('settings.liveTest.event')}</th>
                <th scope="col">{t('settings.liveTest.note')}</th>
                <th scope="col">{t('settings.liveTest.source')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((event) => (
                <tr key={`${event.time}-${event.type}-${event.pitch}`}>
                  <td>{t('settings.liveTest.type', { type: event.type })}</td>
                  <td>{label(event.pitch)}</td>
                  <td>{tc(`sources.${event.source}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
