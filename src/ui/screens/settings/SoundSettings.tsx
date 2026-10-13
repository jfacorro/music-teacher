import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { measureClickTiming } from '../../../audio/calibrateTiming';
import { setSoundTiming } from '../../../preferences';
import { useSettings } from '../../../storage/settings';
import { SoundDelay } from '../../components/SoundDelay';

const TAPS = 12;
const COUNT_IN = 4;

type Task =
  | { kind: 'idle' }
  | { kind: 'running'; beat: number; countingIn: boolean }
  | { kind: 'done'; ms: number; taps: number }
  | { kind: 'failed' };

/** Output delay readout and the tap-along timing correction for metronome clicks. */
export function SoundSettings() {
  const { t } = useTranslation('screens');
  const correction = useSettings((s) => s.soundTimingMs);
  const [task, setTask] = useState<Task>({ kind: 'idle' });
  const running = task.kind === 'running';

  const measure = async () => {
    setTask({ kind: 'running', beat: 0, countingIn: true });
    const result = await measureClickTiming({
      taps: TAPS,
      countIn: COUNT_IN,
      onBeat: (beat, countingIn) => setTask({ kind: 'running', beat, countingIn }),
    });
    // Fewer than half the clicks tapped: not reliable.
    if (result.offsetMs === null || result.taps < TAPS / 2) {
      setTask({ kind: 'failed' });
      return;
    }
    const ms = Math.round(correction + result.offsetMs);
    setSoundTiming(ms);
    setTask({ kind: 'done', ms, taps: result.taps });
  };

  return (
    <section className="card">
      <h2>{t('settings.sound.heading')}</h2>
      <SoundDelay />
      <p className="muted">{t('settings.sound.intro')}</p>
      <p>{t('settings.sound.correction', { ms: correction })}</p>
      <div className="button-row">
        <button
          type="button"
          className="button button--primary"
          disabled={running}
          onClick={() => void measure()}
        >
          {t('settings.sound.measure')}
        </button>
        <button
          type="button"
          className="button"
          disabled={running || correction === 0}
          onClick={() => setSoundTiming(0)}
        >
          {t('settings.sound.reset')}
        </button>
      </div>
      {task.kind === 'running' && (
        <p className="notice" role="status">
          {task.countingIn
            ? t('settings.sound.countIn', { beat: task.beat })
            : t('settings.sound.running', { beat: task.beat - COUNT_IN, total: TAPS })}
        </p>
      )}
      {task.kind === 'done' && (
        <p className="notice notice--ok" role="status">
          {t('settings.sound.done', { ms: task.ms, taps: task.taps, total: TAPS })}
        </p>
      )}
      {task.kind === 'failed' && (
        <p className="notice notice--problem" role="status">
          {t('settings.sound.failed')}
        </p>
      )}
      <p className="muted">{t('settings.sound.micFirst')}</p>
    </section>
  );
}
