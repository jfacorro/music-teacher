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
import { HeldNote } from '../../engine/vocalRange';
import { useNoteNames } from '../../i18n/useNoteNames';
import { MicStatus, startMic, stopMic, useMic } from '../../input/mic/micInput';
import { updateSettings, useSettings } from '../../storage/settings';
import { pitchFromMidi } from '../../theory/pitch';
import { keyboardLayout } from '../keyboard/layout';
import { PianoKeyboard } from '../keyboard/PianoKeyboard';
import { KeyLabels } from '../keyboard/styles';

/** The keyboard shown, as for the vocal range: from a low bass to a high soprano (E2–C6). */
const LOWEST_KEY = 40;
const HIGHEST_KEY = 84;

/** The line of what was sung: semitones shown above and below the note in the middle. */
const ROWS_AROUND = 3;
const ROW_HEIGHT = 16;
const TRACE_WIDTH = 420;
const LABEL_WIDTH = 30;
const TRACE_HEIGHT = (2 * ROWS_AROUND + 1) * ROW_HEIGHT;

interface TracePoint {
  /** performance.now() ms. */
  time: number;
  /** Exact pitch in semitones, or null when nothing clear was heard. */
  pitch: number | null;
}

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
  const layout = useMemo(() => keyboardLayout(LOWEST_KEY, HIGHEST_KEY), []);
  const noteName = (midi: number, octave = true) => names.name(pitchFromMidi(midi), { octave });

  // The microphone, while the page is open (off again if it was off).
  useEffect(() => {
    const started = useMic.getState().status !== MicStatus.On;
    let open = true;
    if (started) {
      void startMic(useSettings.getState().micDeviceId).then(() => {
        if (!open) stopMic();
      });
    }
    return () => {
      open = false;
      if (started) stopMic();
    };
  }, []);

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

/** How far off, as a needle over −50 to +50 cents, with the in-tune zone in green. */
function Needle({ cents }: { cents: number }) {
  const x = (value: number) => 70 + (Math.max(-50, Math.min(50, value)) / 50) * 65;
  return (
    <svg className="tuner__needle" viewBox="0 0 140 34" aria-hidden="true">
      <rect x={5} y={14} width={130} height={8} rx={4} className="tuner__needle-track" />
      <rect x={x(-25)} y={14} width={x(25) - x(-25)} height={8} className="tuner__needle-zone" />
      <line x1={70} y1={8} x2={70} y2={28} className="tuner__needle-center" />
      <polygon
        points={`${x(cents) - 3},6 ${x(cents) + 3},6 ${x(cents)},30`}
        className={isInTune(cents) ? 'tuner__needle-in' : 'tuner__needle-off'}
      />
    </svg>
  );
}

/** The last seconds as a line over rows of semitones, centered on the latest note sung. */
function Trace({
  points,
  labelFor,
}: {
  points: readonly TracePoint[];
  labelFor: (midi: number) => string;
}) {
  const sung = points.filter((point) => point.pitch !== null);
  const last = sung.at(-1);
  const end = points.at(-1)?.time ?? 0;
  const center = last?.pitch == null ? null : Math.round(last.pitch);
  const y = (pitch: number) => (center! + ROWS_AROUND + 0.5 - pitch) * ROW_HEIGHT;
  const x = (time: number) =>
    LABEL_WIDTH + ((time - (end - TRACE_MS)) / TRACE_MS) * (TRACE_WIDTH - LABEL_WIDTH);

  // The line breaks where nothing clear was heard.
  const lines: string[] = [];
  let current: string[] = [];
  for (const point of points) {
    if (point.pitch === null || center === null) {
      if (current.length > 1) lines.push(current.join(' '));
      current = [];
    } else {
      current.push(`${x(point.time).toFixed(1)},${y(point.pitch).toFixed(1)}`);
    }
  }
  if (current.length > 1) lines.push(current.join(' '));

  return (
    <svg className="tuner__trace" viewBox={`0 0 ${TRACE_WIDTH} ${TRACE_HEIGHT}`} aria-hidden="true">
      {center !== null && (
        <>
          <rect
            x={LABEL_WIDTH}
            y={y(center + 0.25)}
            width={TRACE_WIDTH - LABEL_WIDTH}
            height={ROW_HEIGHT / 2}
            className="tuner__trace-zone"
          />
          {Array.from({ length: 2 * ROWS_AROUND + 1 }, (_, i) => center + ROWS_AROUND - i).map(
            (midi) => (
              <g key={midi}>
                <line
                  x1={LABEL_WIDTH}
                  y1={y(midi)}
                  x2={TRACE_WIDTH}
                  y2={y(midi)}
                  className="tuner__trace-row"
                />
                <text x={0} y={y(midi) + 4} className="tuner__trace-name">
                  {labelFor(midi)}
                </text>
              </g>
            ),
          )}
          {lines.map((line, i) => (
            <polyline key={i} points={line} className="tuner__trace-line" />
          ))}
        </>
      )}
    </svg>
  );
}
