import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  AVERAGE_OF,
  type Beyond,
  exactPitch,
  furthestBeyond,
  isInTune,
  TRACE_MS,
  tunerNote,
} from '../../engine/tuner';
import { Hand } from '../../engine/score';
import { HeldNote } from '../../engine/vocalRange';
import { useNoteNames } from '../../i18n/useNoteNames';
import { MicStatus, useMic } from '../../input/mic/micInput';
import { recordResult, ResultKind } from '../../storage/progress';
import { updateSettings, useSettings } from '../../storage/settings';
import { pitchFromMidi } from '../../theory/pitch';
import { keyboardLayout } from '../keyboard/layout';
import { PianoKeyboard } from '../keyboard/PianoKeyboard';
import { KeyLabels } from '../keyboard/styles';
import { useMicWhileShown } from '../hooks';
import { MATCH_ID, MatchTheNote } from './MatchTheNote';
import { Needle, Trace, type TracePoint } from './TunerParts';

/** The keyboard shown, as for the vocal range: from a low bass to a high soprano (E2–C6). */
const LOWEST_KEY = 40;
const HIGHEST_KEY = 84;

/**
 * Sing anything: the note being sung and how far off, the last few seconds as a line, and the
 * saved vocal range, which the furthest steady notes sung beyond it can widen.
 */
export function TunerScreen() {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const micStatus = useMic((s) => s.status);
  const range = useSettings((s) => s.vocalRange);
  const [recent, setRecent] = useState<number[]>([]);
  const [trace, setTrace] = useState<TracePoint[]>([]);
  /** The furthest notes held steadily (as in the range test) beyond the range, to add to it. */
  const [beyond, setBeyond] = useState<Beyond>({ low: null, high: null });
  /** The note to sing in Match the note, shown on the keyboard. */
  const [target, setTarget] = useState<number | null>(null);
  const layout = useMemo(() => keyboardLayout(LOWEST_KEY, HIGHEST_KEY), []);
  const noteName = (midi: number, octave = true) => names.name(pitchFromMidi(midi), { octave });

  useMicWhileShown();

  useEffect(() => {
    const hold = new HeldNote();
    return useMic.subscribe(({ reading }) => {
      const now = performance.now();
      const pitch = reading ? exactPitch(reading) : null;
      setRecent((previous) => (pitch === null ? [] : [...previous, pitch].slice(-AVERAGE_OF)));
      setTrace((previous) => [
        ...previous.filter((point) => now - point.time <= TRACE_MS),
        { time: now, pitch },
      ]);
      const steady = hold.update(reading?.midi ?? null, now);
      const saved = useSettings.getState().vocalRange;
      const held = steady.held >= 1 ? steady.note : null;
      if (saved && held !== null) setBeyond((previous) => furthestBeyond(previous, saved, held));
    });
  }, []);

  const note = tunerNote(recent);
  const status =
    note === null
      ? t('tuner.singSomething')
      : note.cents === 0
        ? t('tuner.inTune')
        : isInTune(note.cents)
          ? t('tuner.inTuneBy', { offset: offsetText(note.cents) })
          : offsetText(note.cents);
  function offsetText(cents: number) {
    return t(cents > 0 ? 'tuner.sharp' : 'tuner.flat', { cents: Math.abs(cents) });
  }

  return (
    <section className="screen tuner">
      <h1>{t('tuner.title')}</h1>
      <p className="muted">{t('tuner.intro')}</p>
      <div className="card tuner__main">
        <div className="tuner__note" role="status">
          <span className="muted">
            {note === null ? t('tuner.listening') : t('settings.voice.singing')}
          </span>
          <strong>{note === null ? '—' : noteName(note.midi)}</strong>
          <span
            className={
              note === null
                ? 'muted'
                : isInTune(note.cents)
                  ? 'tuner__status tuner__status--in'
                  : 'tuner__status tuner__status--off'
            }
          >
            {status}
          </span>
          {note !== null && <Needle cents={note.cents} />}
        </div>
        <div>
          <p className="muted tuner__trace-label">{t('tuner.last')}</p>
          <Trace points={trace} labelFor={(midi) => noteName(midi, false)} />
        </div>
      </div>

      <MatchTheNote
        onTarget={setTarget}
        onFinish={({ stars, accuracy }, durationMs) =>
          void recordResult(ResultKind.Voice, MATCH_ID, { stars, accuracy, durationMs })
        }
      />

      <div className="card">
        <h2>{t('tuner.range')}</h2>
        {range ? (
          <p className="muted">
            {t('tuner.rangeValue', { low: noteName(range.low), high: noteName(range.high) })}{' '}
            <Link to="/settings#voice">{t('tuner.testAgain')}</Link>
          </p>
        ) : (
          <p className="muted">
            {t('tuner.noRange')} <Link to="/settings#voice">{t('tuner.findRange')}</Link>
          </p>
        )}
        {range && (beyond.low !== null || beyond.high !== null) && (
          <div className="tuner__beyond">
            {beyond.low !== null && (
              <span>{t('tuner.newLow', { note: noteName(beyond.low) })}</span>
            )}
            {beyond.high !== null && (
              <span>{t('tuner.newHigh', { note: noteName(beyond.high) })}</span>
            )}
            <button
              type="button"
              className="button"
              onClick={() => {
                updateSettings({
                  vocalRange: {
                    ...range,
                    low: Math.min(range.low, beyond.low ?? range.low),
                    high: Math.max(range.high, beyond.high ?? range.high),
                  },
                });
                setBeyond({ low: null, high: null });
              }}
            >
              {t('tuner.addToRange')}
            </button>
          </div>
        )}
        <PianoKeyboard
          layout={layout}
          pressed={new Set(note === null ? [] : [note.midi])}
          expected={new Map(target === null ? [] : [[target, { hand: Hand.Right }]])}
          completed={
            new Set(
              range
                ? Array.from({ length: range.high - range.low + 1 }, (_, i) => range.low + i)
                : [],
            )
          }
          labels={KeyLabels.C}
          labelFor={(midi) => noteName(midi)}
        />
      </div>

      {micStatus === MicStatus.Denied && (
        <p className="notice notice--problem">{t('settings.voice.micDenied')}</p>
      )}
      {(micStatus === MicStatus.Unsupported || micStatus === MicStatus.Error) && (
        <p className="notice notice--problem">{t('tuner.micUnavailable')}</p>
      )}
    </section>
  );
}
