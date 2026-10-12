import { useEffect, useState, type RefObject } from 'react';

export interface Size {
  width: number;
  height: number;
}

/** CSS size of an element, kept up to date with a ResizeObserver. */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** Sizes the canvas backing store for the device pixel ratio; draw in CSS pixels. */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  { width, height }: Size,
): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

/** Changes whenever the light/dark color scheme changes, to trigger a redraw. */
export function useColorScheme(): 'light' | 'dark' {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return dark ? 'dark' : 'light';
}

/** Reads CSS custom properties (e.g. `--key-white`) so canvases follow the theme. */
export function readCssColors<K extends string>(
  element: Element,
  names: Record<K, string>,
): Record<K, string> {
  const style = getComputedStyle(element);
  return Object.fromEntries(
    Object.entries(names).map(([key, variable]) => [
      key,
      style.getPropertyValue(variable as string).trim(),
    ]),
  ) as Record<K, string>;
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}
