import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPercent } from '../../../i18n/format';
import { startMicMidiComparison } from '../../../input/mic/calibrate';
import type { Comparison } from '../../../input/mic/calibration';
import { useMic } from '../../../input/mic/micInput';
import { downloadBlob, startMicRecording, type MicRecording } from '../../../input/mic/recording';
import { useMidi } from '../../../input/midi/midiInput';
import { setMicCalibration } from '../../../preferences';
import { useSettings } from '../../../storage/settings';

/**
 * The Phase 1 checkpoint: play with MIDI and the microphone both on; MIDI is the ground
 * truth for what the microphone should hear.
 */
export function MicCheck() {
  const { t, i18n } = useTranslation('screens');
  const micOn = useMic((s) => s.status === 'on');
  const midiOn = useMidi((s) => s.connection === 'connected');
  const latencyMs = useSettings((s) => s.micLatencyMs);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Comparison | null>(null);
  const [record, setRecord] = useState(true);
  const [recording, setRecording] = useState<MicRecording | null>(null);
  const recorder = useRef<ReturnType<typeof startMicRecording> | null>(null);

  useEffect(() => {
    if (!running) return;
    return startMicMidiComparison(setResult);
  }, [running]);

  // Stop recording if the check goes away (e.g. the microphone was turned off).
  useEffect(() => () => void recorder.current?.stop(), []);

  if (!micOn || !midiOn) return null;

  const toggle = () => {
    if (running) {
      setRecording(recorder.current?.stop() ?? null);
      recorder.current = null;
    } else {
      setResult(null);
      setRecording(null);
      if (record) {
        recorder.current = startMicRecording({
          gateDb: useMic.getState().gateDb,
          micDelayMs: latencyMs,
        });
      }
    }
    setRunning(!running);
  };

  const save = (saved: MicRecording) => {
    const name = `mic-check-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
    downloadBlob(saved.file, `${name}.json`);
  };

  const rows: [string, string][] = result
    ? [
        [t('settings.micCheck.played'), String(result.reference)],
        [t('settings.micCheck.together'), String(result.together)],
        [
          t('settings.micCheck.correct'),
          t('settings.micCheck.correctValue', {
            count: result.correct,
            percent: formatPercent(result.accuracy, i18n.language),
          }),
        ],
        [t('settings.micCheck.octaveErrors'), String(result.octaveErrors)],
        [t('settings.micCheck.wrongPitch'), String(result.wrongPitch)],
        [t('settings.micCheck.missed'), String(result.missed)],
        [t('settings.micCheck.extra'), String(result.extra)],
        [
          t('settings.micCheck.delay'),
          result.latencyMs === null
            ? t('settings.micCheck.noValue')
            : t('settings.micCheck.ms', { ms: Math.round(result.latencyMs) }),
        ],
        [
          t('settings.micCheck.spread'),
          result.jitterMs === null
            ? t('settings.micCheck.noValue')
            : t('settings.micCheck.ms', { ms: Math.round(result.jitterMs) }),
        ],
      ]
    : [];

  return (
    <section className="card">
      <h2>{t('settings.micCheck.heading')}</h2>
      <p className="muted">{t('settings.micCheck.intro')}</p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={record}
          disabled={running}
          onChange={(e) => setRecord(e.target.checked)}
        />
        {t('settings.micCheck.record')}
      </label>
      <div className="button-row">
        <button
          type="button"
          className={running ? 'button' : 'button button--primary'}
          onClick={toggle}
        >
          {running ? t('settings.micCheck.stop') : t('settings.micCheck.start')}
        </button>
        {result?.latencyMs != null && result.correct >= 5 && (
          <button
            type="button"
            className="button"
            onClick={() => setMicCalibration({ latencyMs: latencyMs + result.latencyMs! })}
          >
            {t('settings.micCheck.useDelay', { ms: Math.round(result.latencyMs) })}
          </button>
        )}
      </div>
      {recording && !running && (
        <div className="notice">
          <p>{t('settings.micCheck.saveHint')}</p>
          <button type="button" className="button" onClick={() => save(recording)}>
            {t('settings.micCheck.save', { seconds: Math.round(recording.seconds) })}
          </button>
        </div>
      )}
      {rows.length > 0 && (
        <table className="events">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
