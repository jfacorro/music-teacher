import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  enableMidi,
  retryMidiConnection,
  selectDevice,
  useMidi,
  MidiAccessState,
  MidiConnection,
} from '../../../input/midi/midiInput';

export function MidiSettings() {
  const { t } = useTranslation('screens');
  const access = useMidi((s) => s.access);
  const devices = useMidi((s) => s.devices);
  const selectedId = useMidi((s) => s.selectedId);
  const selectedName = useMidi((s) => s.selectedName);
  const connection = useMidi((s) => s.connection);
  const sustain = useMidi((s) => s.sustain);
  const deviceId = useId();

  const device = selectedName ?? '';
  const selectedListed = devices.some((d) => d.id === selectedId);

  return (
    <section className="card">
      <h2>{t('settings.midi.heading')}</h2>

      {access === MidiAccessState.Unsupported && (
        <p className="notice notice--problem">{t('settings.midi.unsupported')}</p>
      )}

      {(access === MidiAccessState.Idle ||
        access === MidiAccessState.Requesting ||
        access === MidiAccessState.Denied) && (
        <>
          <p>{t('settings.midi.intro')}</p>
          {access === MidiAccessState.Denied && (
            <p className="notice notice--problem">{t('settings.midi.denied')}</p>
          )}
          <button
            type="button"
            className="button button--primary"
            disabled={access === MidiAccessState.Requesting}
            onClick={() => void enableMidi()}
          >
            {access === MidiAccessState.Requesting
              ? t('settings.midi.requesting')
              : t('settings.midi.enable')}
          </button>
        </>
      )}

      {access === MidiAccessState.Granted && (
        <>
          {devices.length > 0 && (
            <div className="field">
              <label htmlFor={deviceId}>{t('settings.midi.device')}</label>
              <select
                id={deviceId}
                value={selectedId ?? ''}
                onChange={(e) => void selectDevice(e.target.value)}
              >
                {!selectedListed && selectedId && (
                  <option value={selectedId} disabled>
                    {t('settings.midi.disconnectedOption', { device })}
                  </option>
                )}
                {devices.map((d) => (
                  <option key={d.id} value={d.id} disabled={!d.available}>
                    {d.available
                      ? d.name
                      : t('settings.midi.disconnectedOption', { device: d.name })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {connection === MidiConnection.Connected && (
            <p className="notice notice--ok" role="status">
              {t('settings.midi.connected', { device })}
            </p>
          )}
          {connection === MidiConnection.Connecting && (
            <p className="notice" role="status">
              {t('settings.midi.connecting', { device })}
            </p>
          )}
          {connection === MidiConnection.None && (
            <p className="notice">{t('settings.midi.noDevices')}</p>
          )}
          {connection === MidiConnection.Disconnected && (
            <p className="notice notice--problem" role="status">
              {t('settings.midi.disconnected', { device })}
            </p>
          )}
          {connection === MidiConnection.Busy && (
            <>
              <p className="notice notice--problem" role="status">
                {t('settings.midi.busy', { device })}
              </p>
              <button type="button" className="button" onClick={retryMidiConnection}>
                {t('settings.midi.retry')}
              </button>
            </>
          )}

          {connection === MidiConnection.Connected && (
            <p className="muted">
              {t('settings.midi.sustain', { state: sustain ? 'down' : 'up' })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
