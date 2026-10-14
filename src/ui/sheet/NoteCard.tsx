/** One note on a treble or bass staff, drawn by OpenSheetMusicDisplay: a quiz flash card. */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { noteCardXml, type Clef } from '../../content/musicxml';
import type { Pitch } from '../../theory/pitch';
import { readCssColors, useColorScheme } from '../canvas';

/** Width of the staff after the clef, in staff spaces. */
const MEASURE_SPACES = 12;

export function NoteCard({ pitch, clef }: { pitch: Pitch; clef: Clef }) {
  const { t } = useTranslation('screens');
  const hostRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
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
          defaultColorMusic: readCssColors(host, { music: '--text' }).music,
        });
        // A staff some notes wide, rather than just around the note.
        osmd.EngravingRules.FixedMeasureWidth = true;
        osmd.EngravingRules.FixedMeasureWidthFixedValue = MEASURE_SPACES;
        osmdRef.current = osmd;
        setStatus('ready');
      })
      .catch((error: unknown) => {
        console.error('Could not load the sheet music renderer', error);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      osmdRef.current?.clear();
      osmdRef.current = null;
      setStatus('loading');
    };
  }, [scheme]);

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || status !== 'ready') return;
    let cancelled = false;
    void osmd
      .load(noteCardXml(pitch, clef))
      .then(() => {
        if (cancelled) return;
        osmd.render();
        if (hostRef.current) cropToStaff(hostRef.current);
      })
      .catch((error: unknown) => console.error('Could not show the note', error));
    return () => {
      cancelled = true;
    };
  }, [pitch, clef, status]);

  return (
    <div className="note-card" role="img" aria-label={t('quiz.cardLabel')}>
      {status === 'error' && <p className="notice notice--problem">{t('practice.sheetError')}</p>}
      <div ref={hostRef} className="note-card__host" />
    </div>
  );
}

/** Staff spaces kept above and below the staff: room for a few ledger lines. */
const MARGIN_SPACES = 3;

/**
 * Trims OpenSheetMusicDisplay's page margins (the card is then sized by CSS): the drawing keeps the staff plus the same room
 * above and below for every note, so cards don't change size from one note to the next.
 */
function cropToStaff(host: HTMLElement): void {
  const svg = host.querySelector('svg');
  if (!svg) return;
  // The staff lines: long, flat shapes.
  const lines = [...svg.querySelectorAll<SVGGraphicsElement>('path, rect')]
    .map((element) => element.getBBox())
    .filter((box) => box.width > 20 && box.height < 3);
  if (lines.length < 5) return;
  const top = Math.min(...lines.map((box) => box.y));
  const bottom = Math.max(...lines.map((box) => box.y));
  const space = (bottom - top) / 4;
  const content = svg.getBBox();
  svg.setAttribute(
    'viewBox',
    [
      content.x - space,
      top - MARGIN_SPACES * space,
      content.width + 2 * space,
      bottom - top + 2 * MARGIN_SPACES * space,
    ].join(' '),
  );
  svg.removeAttribute('width');
  svg.removeAttribute('height');
}
