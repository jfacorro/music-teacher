import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { refreshSoundOutputs, type SoundDevice, useSoundOutput } from '../../../audio/output';
import {
  allowDeviceNames,
  isMicSupported,
  refreshMicDevices,
  useMic,
} from '../../../input/mic/micInput';
import { chooseMicrophone, chooseSpeakers } from '../../../preferences';
import { useSettings } from '../../../storage/settings';

/** Chrome, Edge and the desktop app can play through a chosen output; others use the default. */
const canChooseOutput =
  typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;

/**
 * Which microphone the app listens to and which output it plays through, for the piano and for
 * singing alike. A chosen device that isn't connected is kept, and the default used meanwhile.
 */
export function DeviceSettings() {
  const { t } = useTranslation('screens');
  const microphones = useMic((s) => s.devices);
  const outputs = useSoundOutput((s) => s.outputs);
  const outputId = useSettings((s) => s.soundOutputId);
  const [refused, setRefused] = useState(false);

  // Devices come and go (headphones, USB microphones): keep the lists current while shown.
  useEffect(() => {
    if (!isMicSupported()) return;
    const refresh = () => {
      void refreshMicDevices();
      refreshSoundOutputs();
    };
    refresh();
    navigator.mediaDevices.addEventListener('devicechange', refresh);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refresh);
  }, []);

  if (!isMicSupported()) {
    return (
      <section className="card">
        <h2>{t('settings.devices.heading')}</h2>
        <p className="notice notice--problem">{t('settings.mic.unsupported')}</p>
      </section>
    );
  }

  // Browsers name the devices only once the microphone has been allowed.
  const unnamed = microphones.length === 0 || microphones.some((device) => !device.label);
  const showNames = async () => {
    const allowed = await allowDeviceNames();
    setRefused(!allowed);
    refreshSoundOutputs();
  };

  return (
    <section className="card">
      <h2>{t('settings.devices.heading')}</h2>
      <p className="muted">{t('settings.devices.intro')}</p>
      {unnamed && (
        <>
          <p className="notice">{t('settings.devices.unnamed')}</p>
          <div className="button-row">
            <button type="button" className="button" onClick={() => void showNames()}>
              {t('settings.devices.showNames')}
            </button>
          </div>
          {refused && <p className="notice notice--problem">{t('settings.mic.denied')}</p>}
        </>
      )}
      <MicrophoneSelect />
      {canChooseOutput ? (
        <DeviceSelect
          label={t('settings.devices.speakers')}
          devices={outputs}
          chosen={outputId}
          unnamed={t('settings.devices.unnamedSpeakers')}
          onChange={chooseSpeakers}
        />
      ) : (
        <p className="muted">{t('settings.devices.defaultOutputOnly')}</p>
      )}
      <p className="muted">{t('settings.devices.timing')}</p>
    </section>
  );
}

/** The microphone to listen to (also in the piano's Microphone card). */
export function MicrophoneSelect() {
  const { t } = useTranslation('screens');
  const microphones = useMic((s) => s.devices);
  const micId = useSettings((s) => s.micDeviceId);
  return (
    <DeviceSelect
      label={t('settings.devices.microphone')}
      devices={microphones}
      chosen={micId}
      unnamed={t('settings.mic.unnamedDevice')}
      onChange={(id) => void chooseMicrophone(id)}
    />
  );
}

function DeviceSelect({
  label,
  devices,
  chosen,
  unnamed,
  onChange,
}: {
  label: string;
  devices: readonly SoundDevice[];
  chosen: string | null;
  /** The name shown for a device the browser doesn't name yet. */
  unnamed: string;
  onChange: (id: string | null) => void;
}) {
  const { t } = useTranslation('screens');
  const selectId = useId();
  // Only known to be missing once the browser lists devices at all.
  const missing = chosen !== null && devices.length > 0 && !devices.some((d) => d.id === chosen);
  return (
    <div className="field">
      <label htmlFor={selectId}>{label}</label>
      <select id={selectId} value={chosen ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{t('settings.devices.systemDefault')}</option>
        {chosen !== null && !devices.some((d) => d.id === chosen) && (
          <option value={chosen} disabled>
            {t('settings.devices.chosenMissing')}
          </option>
        )}
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.label || unnamed}
          </option>
        ))}
      </select>
      {missing && <span className="muted">{t('settings.devices.missingHint')}</span>}
    </div>
  );
}
