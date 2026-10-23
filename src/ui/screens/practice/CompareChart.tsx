import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { compareRun, PlayedVerdict, type Recording } from '../../../engine/recording';
import type { Measure, PedalMark, ScoreNote } from '../../../engine/score';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { InputSource } from '../../../input/types';
import { isBlackKey, pitchFromMidi } from '../../../theory/pitch';

/** Pixels per beat and per key. */
const BEAT = 44;
const ROW = 12;
const LABELS = 40;
const HEADER = 18;
const LOUDNESS = 44;
const PEDAL = 16;

/** Played notes by verdict: the chart's colors (see styles.css) and the legend. */
const VERDICT_CLASS: Readonly<Record<PlayedVerdict, string>> = {
  [PlayedVerdict.Correct]: 'compare__played--right',
  [PlayedVerdict.OnTime]: 'compare__played--right',
  [PlayedVerdict.Early]: 'compare__played--early',
  [PlayedVerdict.Late]: 'compare__played--late',
  [PlayedVerdict.Wrong]: 'compare__played--wrong',
  [PlayedVerdict.Ungraded]: 'compare__played--ungraded',
};
const LEGEND = ['written', 'right', 'early', 'late', 'wrong', 'missed'] as const;

interface CompareChartProps {
  /** The whole score (the run is compared with the hands and bars it practiced). */
  notes: readonly ScoreNote[];
  recording: Recording;
  measures: readonly Measure[];
  /** Where the music marks the pedal. */
  pedal?: readonly PedalMark[];
}

/**
 * A run over the music it was played to (PLAN.md milestone 4.2): the written notes as gray
 * bars, what was played on top in color (right, early, late, wrong key), missed notes outlined;
 * with a MIDI keyboard, a strip below shows how hard each key was played, and another the pedal
 * as written and as held.
 */
export function CompareChart({ notes, recording, measures, pedal = [] }: CompareChartProps) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const comparison = useMemo(() => compareRun(notes, recording), [notes, recording]);
  const { written } = comparison;
  const missed = useMemo(() => new Set(comparison.missed), [comparison]);

  const pitches = [
    ...written.map((note) => note.pitch.midi),
    ...recording.notes.map((note) => note.pitch),
  ];
  const low = Math.min(...pitches) - 1;
  const high = Math.max(...pitches) + 1;
  const from = Math.min(recording.from, ...recording.notes.map((note) => note.start));
  const to = Math.max(recording.to, ...recording.notes.map((note) => note.end));
  const showLoudness = recording.notes.some((note) => note.source === InputSource.Midi);

  const x = (beat: number) => LABELS + (beat - from) * BEAT;
  const y = (pitch: number) => HEADER + (high - pitch) * ROW;
  const rows = high - low + 1;
  const width = x(to) + 8;
  const loudnessTop = HEADER + rows * ROW + 8;
  const held = recording.pedal ?? [];
  const marks = pedal.filter((mark) => mark.up > from && mark.down < to);
  const showPedal = marks.length > 0 || held.length > 0;
  const pedalTop = loudnessTop + (showLoudness ? LOUDNESS + 8 : 0);
  const height = showPedal ? pedalTop + PEDAL + 4 : loudnessTop + (showLoudness ? LOUDNESS + 4 : 0);

  const counts = {
    right: comparison.played.filter(
      (n) => n.verdict === PlayedVerdict.Correct || n.verdict === PlayedVerdict.OnTime,
    ).length,
    early: comparison.played.filter((n) => n.verdict === PlayedVerdict.Early).length,
    late: comparison.played.filter((n) => n.verdict === PlayedVerdict.Late).length,
    wrong: comparison.played.filter((n) => n.verdict === PlayedVerdict.Wrong).length,
    missed: comparison.missed.length,
  };

  return (
    <div className="compare">
      <div className="compare__scroll">
        <svg
          className="compare__chart"
          width={width}
          height={height}
          role="img"
          aria-label={t('practice.recording.summary', counts)}
        >
          {Array.from({ length: rows }, (_, i) => high - i).map((pitch) => (
            <rect
              key={pitch}
              className={isBlackKey(pitch) ? 'compare__row compare__row--black' : 'compare__row'}
              x={LABELS}
              y={y(pitch)}
              width={width - LABELS}
              height={ROW}
            />
          ))}
          {Array.from({ length: rows }, (_, i) => high - i)
            .filter((pitch) => pitch % 12 === 0)
            .map((pitch) => (
              <text key={pitch} className="compare__label" x={4} y={y(pitch) + ROW - 2}>
                {names.name(pitchFromMidi(pitch), { octave: true })}
              </text>
            ))}
          {measures
            .filter((measure) => measure.start >= from - 1e-6 && measure.start <= to)
            .map((measure) => (
              <g key={measure.start}>
                <line
                  className="compare__bar"
                  x1={x(measure.start)}
                  x2={x(measure.start)}
                  y1={HEADER - 4}
                  y2={height}
                />
                <text className="compare__label" x={x(measure.start) + 3} y={HEADER - 6}>
                  {measures.indexOf(measure) + 1}
                </text>
              </g>
            ))}
          {written.map((note, i) => (
            <rect
              key={`w${i}`}
              className={
                missed.has(note) ? 'compare__written compare__written--missed' : 'compare__written'
              }
              x={x(note.start)}
              y={y(note.pitch.midi) + 1}
              width={Math.max(2, note.duration * BEAT - 2)}
              height={ROW - 2}
              rx={2}
            />
          ))}
          {comparison.played.map((note, i) => (
            <rect
              key={`p${i}`}
              className={`compare__played ${VERDICT_CLASS[note.verdict]}`}
              x={x(note.start)}
              y={y(note.pitch) + ROW * 0.25}
              width={Math.max(3, (note.end - note.start) * BEAT)}
              height={ROW * 0.5}
              rx={2}
            />
          ))}
          {showLoudness &&
            comparison.played.map((note, i) => (
              <line
                key={`v${i}`}
                className={`compare__loudness ${VERDICT_CLASS[note.verdict]}`}
                x1={x(note.start) + 1}
                x2={x(note.start) + 1}
                y1={loudnessTop + LOUDNESS}
                y2={loudnessTop + LOUDNESS * (1 - note.velocity / 127)}
              />
            ))}
          {showPedal && (
            <g>
              <text className="compare__label" x={4} y={pedalTop + PEDAL - 4}>
                {t('practice.recording.pedalLabel')}
              </text>
              {marks.map((mark) => (
                <rect
                  key={`m${mark.down}`}
                  className="compare__written"
                  x={x(Math.max(mark.down, from))}
                  y={pedalTop + 1}
                  width={Math.max(
                    2,
                    (Math.min(mark.up, to) - Math.max(mark.down, from)) * BEAT - 2,
                  )}
                  height={PEDAL - 2}
                  rx={2}
                />
              ))}
              {held.map((hold) => (
                <rect
                  key={`h${hold.start}`}
                  className="compare__pedal"
                  x={x(hold.start)}
                  y={pedalTop + PEDAL * 0.25}
                  width={Math.max(3, (hold.end - hold.start) * BEAT)}
                  height={PEDAL * 0.5}
                  rx={2}
                />
              ))}
            </g>
          )}
        </svg>
      </div>
      <ul className="compare__legend">
        {LEGEND.map((item) => (
          <li key={item}>
            <span className={`compare__swatch compare__swatch--${item}`} aria-hidden="true" />
            {t(`practice.recording.legend.${item}`)}
          </li>
        ))}
        {comparison.played.some((note) => note.verdict === PlayedVerdict.Ungraded) && (
          <li>
            <span className="compare__swatch compare__swatch--ungraded" aria-hidden="true" />
            {t('practice.recording.legend.ungraded')}
          </li>
        )}
        {showLoudness && <li className="muted">{t('practice.recording.loudness')}</li>}
        {showPedal && <li className="muted">{t('practice.recording.pedal')}</li>}
      </ul>
    </div>
  );
}
