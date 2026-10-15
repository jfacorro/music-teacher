/**
 * Music that doesn't move, drawn by OpenSheetMusicDisplay: quiz cards and the staff pictures in
 * lesson explanations. The drawing is cropped to the staves, with the same room above and below
 * whatever the notes, and sized by the staff spacing so every picture has the same scale.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { readCssColors, useColorScheme } from '../canvas';
import { LoadStatus } from '../loadStatus';

/** Staff spaces kept above and below the staves: room for a few ledger lines. */
const MARGIN_SPACES = 3;

interface StaticStaffProps {
  xml: string;
  /** Accessible description of the picture. */
  label: string;
  /**
   * Width of each bar, in OpenSheetMusicDisplay's fixed-width units (about 1.6 staff spaces each:
   * a whole note in a bar of 3 takes about 5 spaces).
   */
  barWidth?: number;
  /** On-screen size of one staff space, px. */
  spacePx?: number;
}

export function StaticStaff({ xml, label, barWidth = 12, spacePx = 17 }: StaticStaffProps) {
  const { t } = useTranslation('screens');
  const hostRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [status, setStatus] = useState<LoadStatus>(LoadStatus.Loading);
  const scheme = useColorScheme();

  // One renderer, created again only when the colors change.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    void import('opensheetmusicdisplay')
      .then(({ OpenSheetMusicDisplay }) => {
        if (cancelled) return;
        host.replaceChildren();
        const osmd = new OpenSheetMusicDisplay(host, {
          backend: 'svg',
          autoResize: false,
          drawTitle: false,
          drawSubtitle: false,
          drawComposer: false,
          drawLyricist: false,
          drawPartNames: false,
          drawPartAbbreviations: false,
          drawMeasureNumbers: false,
          drawTimeSignatures: false,
          renderSingleHorizontalStaffline: true,
          defaultColorMusic: readCssColors(host, { music: '--text' }).music,
        });
        // Bars some notes wide, rather than just around their notes.
        osmd.EngravingRules.FixedMeasureWidth = true;
        osmd.EngravingRules.FixedMeasureWidthFixedValue = barWidth;
        osmdRef.current = osmd;
        setStatus(LoadStatus.Ready);
      })
      .catch((error: unknown) => {
        console.error('Could not load the sheet music renderer', error);
        if (!cancelled) setStatus(LoadStatus.Error);
      });
    return () => {
      cancelled = true;
      osmdRef.current?.clear();
      osmdRef.current = null;
      setStatus(LoadStatus.Loading);
    };
  }, [scheme, barWidth]);

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || status !== LoadStatus.Ready) return;
    let cancelled = false;
    void osmd
      .load(xml)
      .then(() => {
        if (cancelled) return;
        osmd.render();
        if (hostRef.current) cropToStaves(hostRef.current, spacePx);
      })
      .catch((error: unknown) => console.error('Could not show the music', error));
    return () => {
      cancelled = true;
    };
  }, [xml, status, spacePx]);

  return (
    <div className="static-staff" role="img" aria-label={label}>
      {status === LoadStatus.Error && (
        <p className="notice notice--problem">{t('practice.sheetError')}</p>
      )}
      <div ref={hostRef} className="static-staff__host" />
    </div>
  );
}

/** Trims OpenSheetMusicDisplay's page margins and sizes the picture by its staff spacing. */
function cropToStaves(host: HTMLElement, spacePx: number): void {
  const svg = host.querySelector('svg');
  if (!svg) return;
  // The staff lines: long, flat shapes.
  const lineYs = [
    ...new Set(
      [...svg.querySelectorAll<SVGGraphicsElement>('path, rect')]
        .map((element) => element.getBBox())
        .filter((box) => box.width > 20 && box.height < 3)
        .map((box) => Math.round(box.y * 10) / 10),
    ),
  ].sort((a, b) => a - b);
  if (lineYs.length < 5) return;
  const space = Math.min(...lineYs.slice(1).map((y, i) => y - lineYs[i]!));
  const content = svg.getBBox();
  // The staves plus a margin, or more if something (a name, a far ledger note) sticks out.
  const top = Math.min(lineYs[0]! - MARGIN_SPACES * space, content.y - space / 2);
  const bottom = Math.max(
    lineYs.at(-1)! + MARGIN_SPACES * space,
    content.y + content.height + space / 2,
  );
  const width = content.width + 2 * space;
  svg.setAttribute('viewBox', [content.x - space, top, width, bottom - top].join(' '));
  svg.setAttribute('width', String((width / space) * spacePx));
  svg.setAttribute('height', String(((bottom - top) / space) * spacePx));
}
