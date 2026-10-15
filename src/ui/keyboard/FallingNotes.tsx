import { useEffect, useRef, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  beatsPerMeasure,
  measureAt,
  notesBetween,
  type Score,
  type ScoreNote,
  Hand,
} from '../../engine/score';
import type { LoopRange } from '../../engine/session';
import type { Transport } from '../../engine/transport';
import { useBarSelection } from '../barSelection';
import { pitchClass } from '../../theory/pitch';
import {
  prepareCanvas,
  readCssColors,
  roundedRect,
  useColorScheme,
  useElementSize,
} from '../canvas';
import type { KeyboardLayout } from './layout';
import { NoteStyle } from './styles';

interface FallingNotesProps {
  score: Score;
  transport: Transport;
  layout: KeyboardLayout;
  /** How many seconds of music fit between the top and the keyboard. */
  secondsVisible: number;
  labelFor: (note: ScoreNote) => string;
  /** How each note went; read every frame, so keep the function stable. */
  styleOf?: (note: ScoreNote) => NoteStyle | undefined;
  /** Bars being repeated, shaded. */
  loop?: LoopRange | null;
  /** Lets the user drag across bars to choose them (off when undefined). */
  onSelectBars?: (range: LoopRange) => void;
}

const COLORS = {
  background: '--lane-bg',
  octaveLine: '--lane-octave',
  beatLine: '--grid-beat',
  measureLine: '--grid-measure',
  hitLine: '--hit-line',
  right: '--hand-right',
  left: '--hand-left',
  played: '--note-played',
  missed: '--note-missed',
  noteText: '--badge-text',
  loop: '--accent',
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
  styleOf,
  loop,
  onSelectBars,
}: FallingNotesProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(containerRef);
  const scheme = useColorScheme();

  // The bar under the pointer: the beat at its height, as the notes fall right now.
  const barAt = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.height === 0) return null;
    const visibleBeats = (secondsVisible * transport.tempo) / 60;
    const beat = transport.position() + ((box.bottom - event.clientY) / box.height) * visibleBeats;
    return measureAt(score.measures, beat);
  };
  const { selection, handlers } = useBarSelection(onSelectBars, barAt);
  // Read every frame without restarting the drawing loop.
  const shaded = useRef<LoopRange | null>(null);
  useEffect(() => {
    shaded.current = selection ?? loop ?? null;
  }, [selection, loop]);

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
        styleOf,
        loop: shaded.current,
        colors,
      });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size, score, transport, layout, secondsVisible, labelFor, styleOf, scheme]);

  return (
    <div
      ref={containerRef}
      className={onSelectBars ? 'falling-notes is-selectable' : 'falling-notes'}
      {...handlers}
    >
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
  styleOf?: (note: ScoreNote) => NoteStyle | undefined;
  loop: LoopRange | null;
  colors: Colors;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { score, layout, position, visibleBeats, labelFor, styleOf, loop, colors }: FrameState,
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

  // The bars being repeated: a band with a line at each end.
  const first = loop && score.measures[loop.first];
  const last = loop && score.measures[loop.last];
  if (first && last) {
    const top = yFor(last.start + last.length);
    const bottom = yFor(first.start);
    ctx.fillStyle = colors.loop;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, top, width, bottom - top);
    ctx.globalAlpha = 1;
    ctx.fillRect(0, Math.round(top) - 1, width, 2);
    ctx.fillRect(0, Math.round(bottom) - 1, width, 2);
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
    const style = styleOf?.(note);

    roundedRect(ctx, x, top + 1, w, bottom - top - 2, Math.min(6, w * 0.3));
    ctx.fillStyle =
      style === NoteStyle.Played
        ? colors.played
        : style === NoteStyle.Missed
          ? colors.missed
          : note.hand === Hand.Left
            ? colors.left
            : colors.right;
    ctx.globalAlpha = style === NoteStyle.Muted ? 0.3 : active ? 1 : 0.85;
    const glow = active && style !== NoteStyle.Muted && style !== NoteStyle.Missed;
    ctx.shadowColor = glow ? ctx.fillStyle : 'transparent';
    ctx.shadowBlur = glow ? 12 : 0;
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
