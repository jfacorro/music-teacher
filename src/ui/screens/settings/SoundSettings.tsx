import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { measureClickTiming } from '../../../audio/calibrateTiming';
import { isUnmeasuredOutput, useSoundOutput } from '../../../audio/output';
import { setSoundTiming } from '../../../preferences';
import { updateSettings, useSettings } from '../../../storage/settings';
import { Choice } from '../../components/Choice';
import { METRONOME_CHOICES } from '../../metronomeChoice';
import { SoundDelay } from '../../components/SoundDelay';
import { VolumeControls } from '../../components/VolumeControls';

const TAPS = 12;
const COUNT_IN = 4;

const TapTask = {
  Idle: 'idle',
  Running: 'running',
  Done: 'done',
  Failed: 'failed',
} as const;

type Task =
  | { kind: typeof TapTask.Idle }
  | { kind: typeof TapTask.Running; beat: number; countingIn: boolean }
  | { kind: typeof TapTask.Done; ms: number; taps: number }
  | { kind: typeof TapTask.Failed };

/** Volumes, the output delay readout and the tap-along timing correction for clicks. */
export function SoundSettings() {
  const { t } = useTranslation('screens');
  const correction = useSettings((s) => s.soundTimingMs);
  const timings = useSettings((s) => s.soundTimings);
  const output = useSoundOutput((s) => s.name);
  const metronome = useSettings((s) => s.exerciseMetronome);
  const [task, setTask] = useState<Task>({ kind: TapTask.Idle });
  const running = task.kind === TapTask.Running;

  const measure = async () => {
    setTask({ kind: TapTask.Running, beat: 0, countingIn: true });
    const result = await measureClickTiming({
      taps: TAPS,
      countIn: COUNT_IN,
      onBeat: (beat, countingIn) => setTask({ kind: TapTask.Running, beat, countingIn }),
    });
    // Fewer than half the clicks tapped: not reliable.
    if (result.offsetMs === null || result.taps < TAPS / 2) {
      setTask({ kind: TapTask.Failed });
      return;
    }
    const ms = Math.round(correction + result.offsetMs);
    setSoundTiming(ms);
    setTask({ kind: TapTask.Done, ms, taps: result.taps });
  };

  return (
    <section className="card" id="sound">
      <h2>{t('settings.sound.heading')}</h2>
      <VolumeControls />
      <div className="field">
        <span className="field__label">{t('settings.sound.metronome')}</span>
        <Choice
          label={t('settings.sound.metronome')}
          options={METRONOME_CHOICES}
          value={metronome}
          nameOf={(option) => t(`settings.sound.metronomeChoices.${option}`)}
          onChange={(exerciseMetronome) => updateSettings({ exerciseMetronome })}
        />
        <p className="muted">{t(`settings.sound.metronomeHints.${metronome}`)}</p>
      </div>
      <SoundDelay />
      <p className="muted">{t('settings.sound.intro')}</p>
      {output && <p>{t('settings.sound.output', { output })}</p>}
      <p>
        {isUnmeasuredOutput(timings, output)
          ? t('settings.sound.notMeasured')
          : t('settings.sound.correction', { ms: correction })}
      </p>
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
      {task.kind === TapTask.Running && (
        <p className="notice" role="status">
          {task.countingIn
            ? t('settings.sound.countIn', { beat: task.beat })
            : t('settings.sound.running', { beat: task.beat - COUNT_IN, total: TAPS })}
        </p>
      )}
      {task.kind === TapTask.Done && (
        <p className="notice notice--ok" role="status">
          {t('settings.sound.done', { ms: task.ms, taps: task.taps, total: TAPS })}
        </p>
      )}
      {task.kind === TapTask.Failed && (
        <p className="notice notice--problem" role="status">
          {t('settings.sound.failed')}
        </p>
      )}
      <p className="muted">{t('settings.sound.micFirst')}</p>
    </section>
  );
}
