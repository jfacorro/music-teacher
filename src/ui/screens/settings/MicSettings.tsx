import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { measureDelayByTapping, measureNoiseFloor } from '../../../input/mic/calibrate';
import { useMic } from '../../../input/mic/micInput';
import { disableMic, enableMic, setMicCalibration } from '../../../preferences';
import { useSettings } from '../../../storage/settings';
import { pitchFromMidi } from '../../../theory/pitch';

const METER_MIN_DB = -90;
const METER_MAX_DB = 0;
const TAPS = 8;

type Task =
  | { kind: 'idle' }
  | { kind: 'noise' }
  | { kind: 'delay'; beat: number; countingIn: boolean }
  | { kind: 'noiseDone'; floorDb: number }
  | { kind: 'delayDone'; delayMs: number; taps: number }
  | { kind: 'failed' };

export function MicSettings() {
  const { t } = useTranslation('screens');
  const status = useMic((s) => s.status);
  const devices = useMic((s) => s.devices);
  const deviceId = useMic((s) => s.deviceId);
  const noiseFloorDb = useSettings((s) => s.micNoiseFloorDb);
  const sensitivityDb = useSettings((s) => s.micSensitivityDb);
  const latencyMs = useSettings((s) => s.micLatencyMs);
  const [task, setTask] = useState<Task>({ kind: 'idle' });
  const deviceSelectId = useId();
  const sensitivityId = useId();

  const busy = task.kind === 'noise' || task.kind === 'delay';

  const runNoise = async () => {
    setTask({ kind: 'noise' });
    const floorDb = await measureNoiseFloor();
    if (floorDb === null) {
      setTask({ kind: 'failed' });
      return;
    }
    setMicCalibration({ noiseFloorDb: Math.round(floorDb) });
    setTask({ kind: 'noiseDone', floorDb: Math.round(floorDb) });
  };

  const runDelay = async () => {
    setTask({ kind: 'delay', beat: 0, countingIn: true });
    const result = await measureDelayByTapping({
      taps: TAPS,
      onBeat: (beat, countingIn) => setTask({ kind: 'delay', beat, countingIn }),
    });
    // Fewer than half the clicks answered: not reliable.
    if (result.delayMs === null || result.taps < TAPS / 2) {
      setTask({ kind: 'failed' });
      return;
    }
    const delayMs = latencyMs + result.delayMs;
    setMicCalibration({ latencyMs: delayMs });
    setTask({ kind: 'delayDone', delayMs: Math.round(delayMs), taps: result.taps });
  };

  return (
    <section className="card">
      <h2>{t('settings.mic.heading')}</h2>
      {status === 'unsupported' && (
        <p className="notice notice--problem">{t('settings.mic.unsupported')}</p>
      )}
      {status !== 'unsupported' && status !== 'on' && (
        <>
          <p>{t('settings.mic.intro')}</p>
          {status === 'denied' && (
            <p className="notice notice--problem">{t('settings.mic.denied')}</p>
          )}
          {status === 'error' && (
            <p className="notice notice--problem">{t('settings.mic.error')}</p>
          )}
          <button
            type="button"
            className="button button--primary"
            disabled={status === 'starting'}
            onClick={() => void enableMic()}
          >
            {status === 'starting' ? t('settings.mic.starting') : t('settings.mic.enable')}
          </button>
        </>
      )}

      {status === 'on' && (
        <>
          <div className="field">
            <label htmlFor={deviceSelectId}>{t('settings.mic.device')}</label>
            <select
              id={deviceSelectId}
              value={deviceId ?? ''}
              onChange={(e) => void enableMic(e.target.value)}
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.label || t('settings.mic.unnamedDevice')}
                </option>
              ))}
            </select>
          </div>

          <MicMeter gateDb={noiseFloorDb + sensitivityDb} noiseFloorDb={noiseFloorDb} />

          <div className="field">
            <label htmlFor={sensitivityId}>
              {t('settings.mic.threshold', { db: sensitivityDb })}
            </label>
            <input
              id={sensitivityId}
              type="range"
              min={6}
              max={36}
              step={1}
              value={sensitivityDb}
              onChange={(e) => setMicCalibration({ sensitivityDb: Number(e.target.value) })}
            />
            <span className="muted">{t('settings.mic.thresholdHint')}</span>
          </div>

          <h3>{t('settings.mic.calibration')}</h3>
          <p className="muted">
            {t('settings.mic.summary', { noise: noiseFloorDb, delay: latencyMs })}
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void runNoise()}
            >
              {t('settings.mic.measureNoise')}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void runDelay()}
            >
              {t('settings.mic.measureDelay')}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy || latencyMs === 0}
              onClick={() => setMicCalibration({ latencyMs: 0 })}
            >
              {t('settings.mic.resetDelay')}
            </button>
          </div>
          <p className="muted">{t('settings.mic.headphones')}</p>
          <TaskStatus task={task} />

          <button type="button" className="button" disabled={busy} onClick={disableMic}>
            {t('settings.mic.disable')}
          </button>
        </>
      )}
    </section>
  );
}

function TaskStatus({ task }: { task: Task }) {
  const { t } = useTranslation('screens');
  switch (task.kind) {
    case 'idle':
      return null;
    case 'noise':
      return (
        <p className="notice" role="status">
          {t('settings.mic.noiseRunning')}
        </p>
      );
    case 'delay':
      return (
        <p className="notice" role="status">
          {task.countingIn
            ? t('settings.mic.delayCountIn', { beat: task.beat })
            : t('settings.mic.delayRunning', { beat: task.beat - 4, total: TAPS })}
        </p>
      );
    case 'noiseDone':
      return (
        <p className="notice notice--ok" role="status">
          {t('settings.mic.noiseDone', { db: task.floorDb })}
        </p>
      );
    case 'delayDone':
      return (
        <p className="notice notice--ok" role="status">
          {t('settings.mic.delayDone', { ms: task.delayMs, taps: task.taps, total: TAPS })}
        </p>
      );
    case 'failed':
      return (
        <p className="notice notice--problem" role="status">
          {t('settings.mic.failed')}
        </p>
      );
  }
}

/** Live input level with the noise floor and the gate marked, plus the detected note. */
function MicMeter({ gateDb, noiseFloorDb }: { gateDb: number; noiseFloorDb: number }) {
  const { t } = useTranslation('screens');
  const levelDb = useMic((s) => s.levelDb);
  const reading = useMic((s) => s.reading);
  const names = useNoteNames();
  const position = (db: number) =>
    `${Math.max(0, Math.min(100, ((db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)) * 100))}%`;
  const above = levelDb >= gateDb;

  return (
    <div className="mic-meter">
      <div
        className="mic-meter__bar"
        role="meter"
        aria-label={t('settings.mic.level')}
        aria-valuemin={METER_MIN_DB}
        aria-valuemax={METER_MAX_DB}
        aria-valuenow={Number.isFinite(levelDb) ? Math.round(levelDb) : METER_MIN_DB}
      >
        <div
          className={above ? 'mic-meter__fill is-loud' : 'mic-meter__fill'}
          style={{ width: position(levelDb) }}
        />
        <div
          className="mic-meter__mark mic-meter__mark--floor"
          style={{ insetInlineStart: position(noiseFloorDb) }}
          title={t('settings.mic.floorMark')}
        />
        <div
          className="mic-meter__mark mic-meter__mark--gate"
          style={{ insetInlineStart: position(gateDb) }}
          title={t('settings.mic.gateMark')}
        />
      </div>
      <div className="mic-meter__note" aria-live="polite">
        {reading && above ? names.name(pitchFromMidi(reading.midi), { octave: true }) : ''}
      </div>
    </div>
  );
}
