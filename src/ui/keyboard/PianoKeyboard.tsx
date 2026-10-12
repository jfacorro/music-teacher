import { useEffect, useRef, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Finger, Hand } from '../../engine/score';
import type { KeyMark } from '../../engine/session';
import { pitchClass } from '../../theory/pitch';
import {
  prepareCanvas,
  readCssColors,
  roundedRect,
  useColorScheme,
  useElementSize,
} from '../canvas';
import { BLACK_KEY_HEIGHT, keyAt, type KeyGeometry, type KeyboardLayout } from './layout';

export type KeyLabels = 'none' | 'c' | 'white';

export interface ExpectedKey {
  hand: Hand;
  finger?: Finger;
}

interface PianoKeyboardProps {
  layout: KeyboardLayout;
  /** Keys currently held down (from any input). */
  pressed: ReadonlySet<number>;
  /** Keys the music asks for right now. */
  expected?: ReadonlyMap<number, ExpectedKey>;
  /** Whether each held key was right or wrong; unmarked held keys use the neutral color. */
  marks?: ReadonlyMap<number, KeyMark>;
  labels?: KeyLabels;
  labelFor: (midi: number) => string;
  onKeyDown?: (midi: number, time: number) => void;
  onKeyUp?: (midi: number, time: number) => void;
}

const COLORS = {
  white: '--key-white',
  black: '--key-black',
  border: '--key-border',
  label: '--key-label',
  pressed: '--key-pressed',
  correct: '--key-correct',
  wrong: '--key-wrong',
  right: '--hand-right',
  left: '--hand-left',
  badgeText: '--badge-text',
};
type Colors = Record<keyof typeof COLORS, string>;

const MIN_HEIGHT = 90;
const MAX_HEIGHT = 190;
const KEY_ASPECT = 5; // white key height / width

/** Canvas piano keyboard: shows pressed and expected keys, plays notes on click/touch. */
export function PianoKeyboard({
  layout,
  pressed,
  expected,
  marks,
  labels = 'none',
  labelFor,
  onKeyDown,
  onKeyUp,
}: PianoKeyboardProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { width } = useElementSize(containerRef);
  const height = Math.round(
    Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, (width / layout.whiteCount) * KEY_ASPECT)),
  );
  const scheme = useColorScheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return;
    const ctx = prepareCanvas(canvas, { width, height });
    if (!ctx) return;
    const colors = readCssColors(canvas, COLORS);
    drawKeyboard(ctx, width, height, {
      layout,
      pressed,
      expected,
      marks,
      labels,
      labelFor,
      colors,
    });
  }, [width, height, layout, pressed, expected, marks, labels, labelFor, scheme]);

  // Pointer input: one key per pointer, so several fingers can play on a touch screen,
  // and sliding across keys plays each one (glissando).
  const activePointers = useRef(new Map<number, number>());

  const keyFromEvent = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * layout.whiteCount;
    const y = (event.clientY - rect.top) / rect.height;
    return keyAt(layout, x, y)?.midi;
  };

  const release = (pointerId: number, time: number) => {
    const midi = activePointers.current.get(pointerId);
    if (midi === undefined) return;
    activePointers.current.delete(pointerId);
    onKeyUp?.(midi, time);
  };

  const interactive = Boolean(onKeyDown);

  return (
    <div ref={containerRef} className="piano-keyboard">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t('keyboard.label')}
        style={{ width: '100%', height, touchAction: interactive ? 'none' : undefined }}
        onPointerDown={(event) => {
          if (!interactive || event.button !== 0) return;
          const midi = keyFromEvent(event);
          if (midi === undefined) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          activePointers.current.set(event.pointerId, midi);
          onKeyDown?.(midi, event.timeStamp);
        }}
        onPointerMove={(event) => {
          const current = activePointers.current.get(event.pointerId);
          if (current === undefined) return;
          const midi = keyFromEvent(event);
          if (midi === current) return;
          release(event.pointerId, event.timeStamp);
          if (midi === undefined) return;
          activePointers.current.set(event.pointerId, midi);
          onKeyDown?.(midi, event.timeStamp);
        }}
        onPointerUp={(event) => release(event.pointerId, event.timeStamp)}
        onPointerCancel={(event) => release(event.pointerId, event.timeStamp)}
      />
    </div>
  );
}

interface DrawState {
  layout: KeyboardLayout;
  pressed: ReadonlySet<number>;
  expected?: ReadonlyMap<number, ExpectedKey>;
  marks?: ReadonlyMap<number, KeyMark>;
  labels: KeyLabels;
  labelFor: (midi: number) => string;
  colors: Colors;
}

function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { layout, pressed, expected, marks, labels, labelFor, colors }: DrawState,
): void {
  const unit = width / layout.whiteCount;
  const blackHeight = height * BLACK_KEY_HEIGHT;
  const fontSize = Math.max(8, Math.min(14, unit * 0.4));
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const handColor = (key: KeyGeometry) =>
    expected?.get(key.midi)?.hand === 'L' ? colors.left : colors.right;
  const pressedColor = (key: KeyGeometry) => {
    const mark = marks?.get(key.midi);
    return mark === 'correct' ? colors.correct : mark === 'wrong' ? colors.wrong : colors.pressed;
  };

  for (const key of layout.keys) {
    if (key.black) continue;
    const x = key.x * unit;
    const isPressed = pressed.has(key.midi);
    const want = expected?.get(key.midi);

    roundedRect(ctx, x + 0.5, 0, unit - 1, height - 0.5, Math.min(6, unit * 0.15));
    ctx.fillStyle = colors.white;
    ctx.fill();
    if (want) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = handColor(key);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (isPressed) {
      ctx.fillStyle = pressedColor(key);
      ctx.fill();
    }
    ctx.lineWidth = want && isPressed ? 3 : 1;
    ctx.strokeStyle = want && isPressed ? handColor(key) : colors.border;
    ctx.stroke();

    const showLabel =
      labels === 'white' ? unit >= 14 : labels === 'c' && pitchClass(key.midi) === 0;
    let bottom = height - fontSize * 0.6;
    if (showLabel) {
      ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
      ctx.fillStyle = isPressed ? colors.badgeText : colors.label;
      ctx.fillText(labelFor(key.midi), x + unit / 2, bottom, unit - 2);
      bottom -= fontSize * 1.2;
    }
    if (want?.finger)
      drawFinger(ctx, x + unit / 2, bottom, unit, want.finger, handColor(key), colors);
  }

  for (const key of layout.keys) {
    if (!key.black) continue;
    const x = key.x * unit;
    const w = key.width * unit;
    const isPressed = pressed.has(key.midi);
    const want = expected?.get(key.midi);

    roundedRect(ctx, x, 0, w, blackHeight, Math.min(4, w * 0.15));
    ctx.fillStyle = isPressed ? pressedColor(key) : want ? handColor(key) : colors.black;
    ctx.fill();
    if (want && isPressed) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = handColor(key);
      ctx.stroke();
    }
    if (want?.finger) {
      drawFinger(
        ctx,
        x + w / 2,
        blackHeight - 4,
        w / BLACK_KEY_HEIGHT,
        want.finger,
        colors.black,
        colors,
      );
    }
  }
}

function drawFinger(
  ctx: CanvasRenderingContext2D,
  cx: number,
  bottom: number,
  keyWidth: number,
  finger: Finger,
  color: string,
  colors: Colors,
): void {
  const radius = Math.max(6, Math.min(11, keyWidth * 0.32));
  const cy = bottom - radius;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.font = `700 ${radius * 1.2}px system-ui, sans-serif`;
  ctx.fillStyle = colors.badgeText;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(finger), cx, cy + 0.5);
  ctx.textBaseline = 'alphabetic';
}
