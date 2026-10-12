import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { beatsPerMeasure, notesBetween, type Score, type ScoreNote } from '../../engine/score';
import type { Transport } from '../../engine/transport';
import { pitchClass } from '../../theory/pitch';
import {
  prepareCanvas,
  readCssColors,
  roundedRect,
  useColorScheme,
  useElementSize,
} from '../canvas';
import type { KeyboardLayout } from './layout';

interface FallingNotesProps {
  score: Score;
  transport: Transport;
  layout: KeyboardLayout;
  /** How many seconds of music fit between the top and the keyboard. */
  secondsVisible: number;
  labelFor: (note: ScoreNote) => string;
}

const COLORS = {
  background: '--lane-bg',
  octaveLine: '--lane-octave',
  beatLine: '--grid-beat',
  measureLine: '--grid-measure',
  hitLine: '--hit-line',
  right: '--hand-right',
  left: '--hand-left',
  noteText: '--badge-text',
};
type Colors = Record<keyof typeof COLORS, string>;

/**
 * Notes fall towards the keyboard below; a note reaches the bottom edge (the hit line) at
 * the moment it should be played. Lanes match the keyboard layout exactly.
 */
export function FallingNotes({
  score,
  transport,
  layout,
  secondsVisible,
  labelFor,
}: FallingNotesProps) {
  const { t } = useTranslation();
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
      drawFrame(ctx, size.width, size.height, {
        score,
        layout,
        position: transport.position(),
        visibleBeats: (secondsVisible * transport.tempo) / 60,
        labelFor,
        colors,
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size, score, transport, layout, secondsVisible, labelFor, scheme]);

  return (
    <div ref={containerRef} className="falling-notes">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t('fallingNotes.label')}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

interface FrameState {
  score: Score;
  layout: KeyboardLayout;
  position: number;
  visibleBeats: number;
  labelFor: (note: ScoreNote) => string;
  colors: Colors;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { score, layout, position, visibleBeats, labelFor, colors }: FrameState,
): void {
  const unit = width / layout.whiteCount;
  const pxPerBeat = height / visibleBeats;
  const yFor = (beat: number) => height - (beat - position) * pxPerBeat;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  // Octave lanes: a line left of every C helps follow notes down to the right key.
  ctx.fillStyle = colors.octaveLine;
  for (const key of layout.keys) {
    if (pitchClass(key.midi) === 0 && key.x > 0) ctx.fillRect(key.x * unit - 0.5, 0, 1, height);
  }

  // Beat and measure lines.
  const measureLength = beatsPerMeasure(score.timeSignature);
  for (let beat = Math.ceil(position); beat <= position + visibleBeats; beat++) {
    if (beat < 0) continue;
    const isMeasure = Math.abs(beat / measureLength - Math.round(beat / measureLength)) < 1e-9;
    ctx.fillStyle = isMeasure ? colors.measureLine : colors.beatLine;
    ctx.fillRect(0, Math.round(yFor(beat)) - (isMeasure ? 1 : 0.5), width, isMeasure ? 2 : 1);
  }

  // Notes.
  const inset = Math.max(1, unit * 0.06);
  const fontSize = Math.max(9, Math.min(14, unit * 0.42));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const note of notesBetween(score.notes, position, position + visibleBeats)) {
    const key = layout.byMidi.get(note.pitch.midi);
    if (!key) continue;
    const x = key.x * unit + inset;
    const w = key.width * unit - inset * 2;
    const top = yFor(note.start + note.duration);
    const bottom = yFor(note.start);
    const active = note.start <= position;

    roundedRect(ctx, x, top + 1, w, bottom - top - 2, Math.min(6, w * 0.3));
    ctx.fillStyle = note.hand === 'L' ? colors.left : colors.right;
    ctx.globalAlpha = active ? 1 : 0.85;
    ctx.shadowColor = active ? ctx.fillStyle : 'transparent';
    ctx.shadowBlur = active ? 12 : 0;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (w >= 14 && bottom - top >= fontSize * 1.6) {
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = colors.noteText;
      ctx.fillText(labelFor(note), x + w / 2, Math.min(bottom, height) - fontSize * 0.5, w);
    }
  }

  ctx.fillStyle = colors.hitLine;
  ctx.fillRect(0, height - 3, width, 3);
}
