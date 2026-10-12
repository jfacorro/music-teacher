import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPercent } from '../../../i18n/format';
import { startMicMidiComparison } from '../../../input/mic/calibrate';
import type { Comparison } from '../../../input/mic/calibration';
import { useMic } from '../../../input/mic/micInput';
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

  useEffect(() => {
    if (!running) return;
    return startMicMidiComparison(setResult);
  }, [running]);

  if (!micOn || !midiOn) return null;

  const rows: [string, string][] = result
    ? [
        [t('settings.micCheck.played'), String(result.reference)],
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
      <div className="button-row">
        <button
          type="button"
          className={running ? 'button' : 'button button--primary'}
          onClick={() => {
            if (!running) setResult(null);
            setRunning(!running);
          }}
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
