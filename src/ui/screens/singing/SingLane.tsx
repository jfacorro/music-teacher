/**
 * The singing view (PLAN.md milestone 6.3): the notes to sing as bars in a horizontal lane, on
 * rows named with the note names, moving toward a line where they're due; the voice drawn as a
 * line through them, green while in tune and amber off.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { beatsPerMeasure, notesBetween, type Score, type ScoreNote } from '../../../engine/score';
import type { TrailPoint } from '../../../engine/singSession';
import { TuneLevel } from '../../../engine/singing';
import type { Transport } from '../../../engine/transport';
import { isBlackKey } from '../../../theory/pitch';
import {
  prepareCanvas,
  readCssColors,
  roundedRect,
  useColorScheme,
  useElementSize,
} from '../../canvas';
import { laneRows } from './laneRows';

/** Where notes are due: this share of the width from the left. */
const NOW_AT = 0.28;
/** The rows' names, on the left. */
const LABELS = 38;

const COLORS = {
  background: '--lane-bg',
  blackRow: '--lane-octave',
  beatLine: '--grid-beat',
  measureLine: '--grid-measure',
  now: '--hit-line',
  note: '--hand-right',
  good: '--note-played',
  partly: '--pending',
  off: '--key-wrong',
  noteText: '--badge-text',
  label: '--muted',
  inTune: '--ok',
  offTune: '--pending',
  voice: '--accent',
};
type Colors = Record<keyof typeof COLORS, string>;

export interface SingLaneProps {
  score: Score;
  transport: Transport;
  /** How many seconds of music fit after the line where notes are due. */
  secondsAhead: number;
  /** A row's name, e.g. "Sol". */
  labelFor: (midi: number) => string;
  /** How each note went, once graded; read every frame, so keep it stable. */
  levelOf: (note: ScoreNote) => TuneLevel | undefined;
  /** The line of the voice so far; read every frame. */
  trail: () => readonly TrailPoint[];
  /** What's being sung now (drawn as a dot on the line), and whether in tune; read every frame. */
  voice: () => { pitch: number; inTune: boolean } | null;
}

export function SingLane({
  score,
  transport,
  secondsAhead,
  labelFor,
  levelOf,
  trail,
  voice,
}: SingLaneProps) {
  const { t } = useTranslation('screens');
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(containerRef);
  const scheme = useColorScheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const ctx = prepareCanvas(canvas, size);
    if (!ctx) return;
    const colors = readCssColors(canvas, COLORS);
    let frame = 0;
    const draw = () => {
      drawLane(ctx, size.width, size.height, {
        score,
        position: transport.position(),
        aheadBeats: (secondsAhead * transport.tempo) / 60,
        labelFor,
        levelOf,
        trail: trail(),
        voice: voice(),
        colors,
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size, score, transport, secondsAhead, labelFor, levelOf, trail, voice, scheme]);

  return (
    <div ref={containerRef} className="sing-lane">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t('sing.laneLabel')}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

interface LaneState {
  score: Score;
  position: number;
  aheadBeats: number;
  labelFor: (midi: number) => string;
  levelOf: (note: ScoreNote) => TuneLevel | undefined;
  trail: readonly TrailPoint[];
  voice: { pitch: number; inTune: boolean } | null;
  colors: Colors;
}

function drawLane(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { score, position, aheadBeats, labelFor, levelOf, trail, voice, colors }: LaneState,
): void {
  const { low, high } = laneRows(score.notes);
  const rows = high - low + 1;
  const rowHeight = height / rows;
  const nowX = LABELS + (width - LABELS) * NOW_AT;
  const pxPerBeat = (width - nowX) / aheadBeats;
  const behindBeats = (nowX - LABELS) / pxPerBeat;
  const x = (beat: number) => nowX + (beat - position) * pxPerBeat;
  const y = (pitch: number) => (high + 0.5 - pitch) * rowHeight;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  // Rows: the black keys' a little darker, as on a keyboard turned on its side.
  for (let midi = low; midi <= high; midi++) {
    if (!isBlackKey(midi)) continue;
    ctx.fillStyle = colors.blackRow;
    ctx.fillRect(LABELS, y(midi) - rowHeight / 2, width - LABELS, rowHeight);
  }

  // Beat and measure lines.
  const measure = beatsPerMeasure(score.timeSignature);
  for (let beat = Math.ceil(position - behindBeats); beat <= position + aheadBeats; beat++) {
    if (beat < 0) continue;
    const isMeasure = Math.abs(beat / measure - Math.round(beat / measure)) < 1e-9;
    ctx.fillStyle = isMeasure ? colors.measureLine : colors.beatLine;
    ctx.fillRect(Math.round(x(beat)) - (isMeasure ? 1 : 0.5), 0, isMeasure ? 2 : 1, height);
  }

  // The notes.
  const barHeight = Math.max(6, rowHeight * 0.7);
  const fontSize = Math.max(9, Math.min(14, barHeight * 0.6));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const note of notesBetween(score.notes, position - behindBeats, position + aheadBeats)) {
    const left = x(note.start) + 1;
    const right = x(note.start + note.duration) - 1;
    const level = levelOf(note);
    roundedRect(ctx, left, y(note.pitch.midi) - barHeight / 2, right - left, barHeight, 5);
    ctx.fillStyle =
      level === TuneLevel.Good
        ? colors.good
        : level === TuneLevel.Partly
          ? colors.partly
          : level === TuneLevel.Off
            ? colors.off
            : colors.note;
    ctx.globalAlpha = level === undefined && note.start + note.duration < position ? 0.6 : 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (right - left > fontSize * 2.5) {
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = colors.noteText;
      ctx.fillText(labelFor(note.pitch.midi), left + 6, y(note.pitch.midi), right - left - 8);
    }
  }

  // The voice: a line, green in tune and amber off, broken where nothing clear was heard.
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const shown = trail.filter((point) => point.beat >= position - behindBeats);
  for (let i = 1; i < shown.length; i++) {
    const [a, b] = [shown[i - 1]!, shown[i]!];
    if (a.pitch === null || b.pitch === null) continue;
    ctx.strokeStyle = b.inTune === null ? colors.voice : b.inTune ? colors.inTune : colors.offTune;
    ctx.beginPath();
    ctx.moveTo(x(a.beat), y(a.pitch));
    ctx.lineTo(x(b.beat), y(b.pitch));
    ctx.stroke();
  }
  if (voice) {
    ctx.fillStyle = voice.inTune ? colors.inTune : colors.offTune;
    ctx.beginPath();
    ctx.arc(nowX, Math.max(4, Math.min(height - 4, y(voice.pitch))), 6, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Where notes are due.
  ctx.fillStyle = colors.now;
  ctx.fillRect(nowX - 1.5, 0, 3, height);

  // The rows' names, over a band of their own.
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, LABELS, height);
  ctx.font = `${Math.max(9, Math.min(13, rowHeight * 0.6))}px system-ui, sans-serif`;
  ctx.fillStyle = colors.label;
  ctx.textAlign = 'right';
  if (rowHeight >= 9) {
    for (let midi = low; midi <= high; midi++) {
      ctx.fillText(labelFor(midi), LABELS - 6, y(midi), LABELS - 8);
    }
  }
}
