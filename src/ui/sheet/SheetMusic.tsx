/**
 * Sheet music view (PLAN.md §2.1): the score rendered by OpenSheetMusicDisplay on one
 * horizontal line, with a cursor that follows the transport and scrolls along, and notes
 * colored by how they went (same colors as the falling notes).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GraphicalNote, OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { DIVISIONS, noteKey, scoreToMusicXml } from '../../content/musicxml';
import type { SheetNotation } from '../../content/lessons';
import type { Hand, Score, ScoreNote } from '../../engine/score';
import type { HandFilter } from '../../engine/session';
import { useNoteNames } from '../../i18n/useNoteNames';
import type { Transport } from '../../engine/transport';
import { readCssColors, useColorScheme } from '../canvas';
import { useAnimationFrame } from '../hooks';
import type { NoteStyle } from '../keyboard/FallingNotes';

interface SheetMusicProps {
  score: Score;
  transport: Transport;
  styleOf?: (note: ScoreNote) => NoteStyle;
  /** Changes whenever note outcomes may have changed, to recolor. */
  outcomesVersion?: unknown;
  notation: SheetNotation;
  /** The hands being practiced: other staves are left out unless `notation` is 'grand'. */
  hands: HandFilter;
}

const COLORS = {
  music: '--text',
  cursor: '--accent',
  played: '--note-played',
  missed: '--key-wrong',
  muted: '--muted',
};

interface Rendered {
  osmd: OpenSheetMusicDisplay;
  /** Rendered notes of each score note (tied notes have several). */
  graphics: Map<ScoreNote, GraphicalNote[]>;
  applied: Map<ScoreNote, string>;
  colors: Record<keyof typeof COLORS, string>;
}

/** A little smaller than OSMD's default, so sheet and keyboard fit on a laptop screen. */
const ZOOM = 0.9;

/** Position of an OSMD iterator, in beats (its timestamps are in whole notes). */
const beatOf = (iterator: { currentTimeStamp: { RealValue: number } }) =>
  iterator.currentTimeStamp.RealValue * 4;

export function SheetMusic({
  score,
  transport,
  styleOf,
  outcomesVersion,
  notation,
  hands,
}: SheetMusicProps) {
  const { t } = useTranslation('screens');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendered = useRef<Rendered | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const scheme = useColorScheme();
  const names = useNoteNames();

  const music = useMemo(() => {
    const staves: Hand[] | undefined =
      notation === 'grand' || hands === 'both' ? undefined : [hands];
    return scoreToMusicXml(score, {
      hands: staves,
      noteLabel:
        notation === 'names' ? (note) => names.name(note.pitch, { octave: false }) : undefined,
    });
  }, [score, notation, hands, names]);

  // Render (again when the music or the color scheme changes).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    setStatus('loading');
    rendered.current = null;

    (async () => {
      const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');
      if (cancelled) return;
      const colors = readCssColors(host, COLORS);
      const { xml, notes } = music;
      host.replaceChildren();
      const osmd = new OpenSheetMusicDisplay(host, {
        backend: 'svg',
        autoResize: false,
        autoBeam: true,
        drawTitle: false,
        drawSubtitle: false,
        drawComposer: false,
        drawLyricist: false,
        drawPartNames: false,
        drawPartAbbreviations: false,
        // Measure numbers above the staff look like finger numbers to a beginner.
        drawMeasureNumbers: false,
        // Default spacing: roomy enough for note names under every note.
        drawingParameters: 'default',
        renderSingleHorizontalStaffline: true,
        defaultColorMusic: colors.music,
        followCursor: false,
        cursorsOptions: [{ type: 0, color: colors.cursor, alpha: 0.35, follow: false }],
      });
      await osmd.load(xml);
      if (cancelled) return;
      osmd.zoom = ZOOM;
      osmd.render();
      osmd.cursor.show();
      rendered.current = { osmd, graphics: indexGraphics(osmd, notes), applied: new Map(), colors };
      setStatus('ready');
    })().catch((error: unknown) => {
      console.error('Could not render the sheet music', error);
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      rendered.current?.osmd.clear();
      rendered.current = null;
    };
  }, [music, scheme]);

  // Color notes by outcome.
  useEffect(() => {
    const sheet = rendered.current;
    if (!sheet || status !== 'ready') return;
    for (const [note, graphicals] of sheet.graphics) {
      const style = styleOf?.(note);
      const color =
        style === 'played'
          ? sheet.colors.played
          : style === 'missed'
            ? sheet.colors.missed
            : style === 'muted'
              ? sheet.colors.muted
              : sheet.colors.music;
      if (sheet.applied.get(note) === color) continue;
      sheet.applied.set(note, color);
      for (const graphical of graphicals) {
        graphical.setColor(color, {
          applyToNoteheads: true,
          applyToStem: true,
          applyToFlag: true,
          applyToModifiers: true,
        });
      }
    }
  }, [styleOf, outcomesVersion, status]);

  // Keep the cursor on the notes being played, and scroll it into view.
  useAnimationFrame(() => {
    const sheet = rendered.current;
    const scroller = scrollerRef.current;
    if (!sheet || !scroller) return;
    const cursor = sheet.osmd.cursor;
    const beat = transport.position();
    let moved = false;
    if (beat < beatOf(cursor.iterator) - 1e-6) {
      cursor.reset();
      moved = true;
    }
    for (;;) {
      const peek = cursor.iterator.clone();
      peek.moveToNext();
      if (peek.EndReached || beatOf(peek) > beat + 1e-6) break;
      cursor.next();
      moved = true;
    }
    if (moved) {
      const left = cursor.cursorElement.offsetLeft;
      scroller.scrollTo({
        left: Math.max(0, left - scroller.clientWidth * 0.3),
        behavior: 'smooth',
      });
    }
  });

  return (
    <div ref={scrollerRef} className="sheet-music" role="img" aria-label={t('practice.view.sheet')}>
      {status === 'loading' && (
        <p className="muted sheet-music__status">{t('practice.sheetLoading')}</p>
      )}
      {status === 'error' && (
        <p className="notice notice--problem sheet-music__status">{t('practice.sheetError')}</p>
      )}
      <div ref={hostRef} className="sheet-music__host" />
    </div>
  );
}

/** Finds the rendered notes of each score note, matching staff, position and pitch. */
function indexGraphics(
  osmd: OpenSheetMusicDisplay,
  notes: ReadonlyMap<string, ScoreNote>,
): Map<ScoreNote, GraphicalNote[]> {
  const graphics = new Map<ScoreNote, GraphicalNote[]>();
  for (const measures of osmd.GraphicSheet.MeasureList) {
    measures.forEach((measure, staffIndex) => {
      if (!measure) return;
      for (const entry of measure.staffEntries) {
        const start = Math.round(entry.getAbsoluteTimestamp().RealValue * 4 * DIVISIONS);
        for (const voiceEntry of entry.graphicalVoiceEntries) {
          for (const graphical of voiceEntry.notes) {
            const source = graphical.sourceNote;
            if (source.isRest()) continue;
            // OSMD counts half tones from C0 = 0, one octave below MIDI's C-1 = 0.
            const midi = source.halfTone + 12;
            const note = notes.get(noteKey(staffIndex + 1, start, midi));
            if (!note) continue;
            graphics.set(note, [...(graphics.get(note) ?? []), graphical]);
          }
        }
      }
    });
  }
  return graphics;
}
