/** Choosing bars to loop by dragging across them, on the sheet music or the falling notes. */
import { useRef, useState, type PointerEvent } from 'react';
import type { LoopRange } from '../engine/session';

interface BarSelection {
  /** The bars being dragged across, while dragging. */
  selection: LoopRange | null;
  /** Pointer handlers for the element to drag on (none when selecting is off). */
  handlers: {
    onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel?: () => void;
  };
}

/**
 * The loop after choosing `chosen` on the music: choosing bars that are already repeated
 * (clicking a bar inside the loop, or dragging over exactly its bars) turns it off.
 */
export function toggleBars(current: LoopRange | null, chosen: LoopRange): LoopRange | null {
  const inside = !!current && chosen.first >= current.first && chosen.last <= current.last;
  const same = chosen.first === current?.first && chosen.last === current.last;
  return inside && (chosen.first === chosen.last || same) ? null : chosen;
}

/** Bars for an address, counted from 1: "5-6", or "5" for one bar. */
export function barsParam({ first, last }: LoopRange): string {
  return first === last ? String(first + 1) : `${first + 1}-${last + 1}`;
}

/** The bars in an address ("5-6" or "5", from 1), within the music's `count` bars; null if none. */
export function parseBars(text: string | null, count: number): LoopRange | null {
  const match = text ? /^(\d+)(?:-(\d+))?$/.exec(text) : null;
  if (!match) return null;
  const first = Number(match[1]) - 1;
  const last = Number(match[2] ?? match[1]) - 1;
  return first >= 0 && first <= last && last < count ? { first, last } : null;
}

const between = (a: number, b: number): LoopRange => ({
  first: Math.min(a, b),
  last: Math.max(a, b),
});

/**
 * @param onSelect called with the bars once the drag ends; selecting is off when undefined
 * @param barAt the bar under the pointer, or null
 */
export function useBarSelection(
  onSelect: ((range: LoopRange) => void) | undefined,
  barAt: (event: PointerEvent<HTMLElement>) => number | null,
): BarSelection {
  const [selection, setSelection] = useState<LoopRange | null>(null);
  const anchor = useRef<number | null>(null);

  if (!onSelect) return { selection: null, handlers: {} };
  return {
    selection,
    handlers: {
      onPointerDown(event) {
        const bar = barAt(event);
        if (bar === null || event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        anchor.current = bar;
        setSelection(between(bar, bar));
      },
      onPointerMove(event) {
        const bar = anchor.current === null ? null : barAt(event);
        if (bar === null || anchor.current === null) return;
        const range = between(anchor.current, bar);
        setSelection((current) =>
          current?.first === range.first && current.last === range.last ? current : range,
        );
      },
      onPointerUp(event) {
        const start = anchor.current;
        anchor.current = null;
        setSelection(null);
        if (start !== null) onSelect(between(start, barAt(event) ?? start));
      },
      onPointerCancel() {
        anchor.current = null;
        setSelection(null);
      },
    },
  };
}
