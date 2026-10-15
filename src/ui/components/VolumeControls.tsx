import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { type AudioEngine, startAudio } from '../../audio/audio';
import { VOLUME_MAX } from '../../audio/volume';
import { formatPercent } from '../../i18n/format';
import { setVolume } from '../../preferences';
import { useSettings } from '../../storage/settings';
import { MIDDLE_C } from '../../theory/pitch';
import { ICONS } from '../icons';

/** Dragging plays a sample at most this often, ms. */
const SAMPLE_EVERY_MS = 250;
/** Samples start this far ahead, so they aren't dropped as late, ms. */
const SAMPLE_LEAD_MS = 40;
const SAMPLE_NOTE_MS = 500;

let lastSample = 0;

/** A sample of a sound at its new volume, while the slider moves. */
function sample(play: (audio: AudioEngine, at: number) => void): void {
  const now = performance.now();
  if (now - lastSample < SAMPLE_EVERY_MS) return;
  lastSample = now;
  void startAudio().then((audio) => play(audio, performance.now() + SAMPLE_LEAD_MS));
}

const SLIDERS = [
  {
    setting: 'metronomeVolume',
    label: 'volume.metronome',
    sample: (audio: AudioEngine, at: number) => audio.click(at, true),
  },
  {
    setting: 'pianoVolume',
    label: 'volume.piano',
    sample: (audio: AudioEngine, at: number) => audio.accompany(MIDDLE_C, at, at + SAMPLE_NOTE_MS),
  },
] as const;

/** Metronome and piano volume sliders; each plays a sample of its sound while it moves. */
export function VolumeControls() {
  const { t, i18n } = useTranslation();
  const id = useId();
  const volumes = {
    metronomeVolume: useSettings((s) => s.metronomeVolume),
    pianoVolume: useSettings((s) => s.pianoVolume),
  };

  return (
    <div className="volume-controls">
      {SLIDERS.map((slider) => {
        const value = volumes[slider.setting];
        return (
          <div key={slider.setting} className="field">
            <label htmlFor={`${id}-${slider.setting}`}>{t(slider.label)}</label>
            <div className="volume-controls__row">
              <input
                id={`${id}-${slider.setting}`}
                type="range"
                min={0}
                max={VOLUME_MAX}
                step={5}
                value={value}
                onChange={(e) => {
                  setVolume({ [slider.setting]: Number(e.target.value) });
                  sample(slider.sample);
                }}
              />
              <output className="volume-controls__value" htmlFor={`${id}-${slider.setting}`}>
                {formatPercent(value / VOLUME_MAX, i18n.language)}
              </output>
            </div>
          </div>
        );
      })}
      <p className="muted">{t('volume.pianoHint')}</p>
    </div>
  );
}

/** A speaker button that opens the volume sliders under it (Escape or a click outside closes). */
export function VolumeButton() {
  const { t } = useTranslation();
  const id = useId();
  return (
    <>
      <button
        type="button"
        className="button button--icon volume-button"
        popoverTarget={id}
        aria-label={t('volume.button')}
        title={t('volume.tip')}
      >
        <span aria-hidden="true">{ICONS.volume}</span>
      </button>
      <div id={id} popover="auto" className="volume-popover">
        <VolumeControls />
      </div>
    </>
  );
}
