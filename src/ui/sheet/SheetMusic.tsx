/**
 * Sheet music view (PLAN.md §2.1): the score rendered by OpenSheetMusicDisplay on one
 * horizontal line, with a cursor that follows the transport and scrolls along, and notes
 * colored by how they went (same colors as the falling notes).
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GraphicalNote, OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { DIVISIONS, noteKey, scoreToMusicXml } from '../../content/musicxml';
import { SheetNotation } from '../../content/lessons';
import { Hand, type Score, type ScoreNote } from '../../engine/score';
import { HandFilter, type LoopRange } from '../../engine/session';
import { useNoteNames } from '../../i18n/useNoteNames';
import type { Transport } from '../../engine/transport';
import { useBarSelection } from '../barSelection';
import { readCssColors, useColorScheme } from '../canvas';
import { useAnimationFrame } from '../hooks';
import { NoteStyle } from '../keyboard/styles';
import { LoadStatus } from '../loadStatus';

interface SheetMusicProps {
  score: Score;
  transport: Transport;
  styleOf?: (note: ScoreNote) => NoteStyle | undefined;
  /** Changes whenever note outcomes may have changed, to recolor. */
  outcomesVersion?: unknown;
  notation: SheetNotation;
  /** The hands being practiced: other staves are left out unless `notation` is 'grand'. */
  hands: HandFilter;
  /** Bars being repeated, shaded. */
  loop?: LoopRange | null;
  /** Lets the user drag across bars to choose them (off when undefined). */
  onSelectBars?: (range: LoopRange) => void;
  /** A rhythm exercise: one line, no pitches. */
  rhythm?: boolean;
}

/** Where a bar is drawn: px from the left of the sheet. */
interface BarBox {
  left: number;
  right: number;
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
  loop,
  onSelectBars,
  rhythm = false,
}: SheetMusicProps) {
  const { t } = useTranslation('screens');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendered = useRef<Rendered | null>(null);
  const [status, setStatus] = useState<LoadStatus>(LoadStatus.Loading);
  const [bars, setBars] = useState<BarBox[]>([]);
  const scheme = useColorScheme();
  const names = useNoteNames();

  const music = useMemo(() => {
    if (rhythm) return scoreToMusicXml(score, { rhythm: true });
    const staves: Hand[] | undefined =
      notation === SheetNotation.Grand
        ? [Hand.Right, Hand.Left]
        : hands === HandFilter.Both
          ? undefined
          : [hands];
    return scoreToMusicXml(score, {
      hands: staves,
      noteLabel:
        notation === SheetNotation.Names
          ? (note) => names.name(note.pitch, { octave: false })
          : undefined,
      handLabel: (hand) => t(`practice.crossedHand.${hand}`),
    });
  }, [score, notation, hands, names, rhythm, t]);

  // Render (again when the music or the color scheme changes).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    setStatus(LoadStatus.Loading);
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
      setBars(barBoxes(osmd));
      setStatus(LoadStatus.Ready);
    })().catch((error: unknown) => {
      console.error('Could not render the sheet music', error);
      if (!cancelled) setStatus(LoadStatus.Error);
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
    if (!sheet || status !== LoadStatus.Ready) return;
    for (const [note, graphicals] of sheet.graphics) {
      const style = styleOf?.(note);
      const color =
        style === NoteStyle.Played
          ? sheet.colors.played
          : style === NoteStyle.Missed
            ? sheet.colors.missed
            : style === NoteStyle.Muted
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

  // Keep the cursor on the notes being played, and scroll it into view when it moves or the
  // music starts. Otherwise the sheet stays where it is, so it can be read ahead (before starting,
  // or paused).
  const wasPlaying = useRef(false);
  useAnimationFrame(() => {
    const sheet = rendered.current;
    const scroller = scrollerRef.current;
    if (!sheet || !scroller) return;
    const cursor = sheet.osmd.cursor;
    const beat = transport.position();
    let moved = transport.playing && !wasPlaying.current;
    wasPlaying.current = transport.playing;
    if (beat < beatOf(cursor.iterator) - 1e-6) {
      // Before the start (e.g. the count-in), a cursor already at the start doesn't move.
      const before = beatOf(cursor.iterator);
      cursor.reset();
      moved ||= beatOf(cursor.iterator) !== before;
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

  const barAt = (event: PointerEvent<HTMLElement>) => {
    const host = hostRef.current;
    if (!host || bars.length === 0) return null;
    const x = event.clientX - host.getBoundingClientRect().left;
    const index = bars.findIndex((bar) => x < bar.right);
    return index < 0 ? bars.length - 1 : index;
  };
  const { selection, handlers } = useBarSelection(onSelectBars, barAt);
  const shaded = selection ?? loop ?? null;
  const from = shaded && bars[shaded.first];
  const to = shaded && bars[shaded.last];

  return (
    <div
      ref={scrollerRef}
      className={onSelectBars ? 'sheet-music is-selectable' : 'sheet-music'}
      role="img"
      aria-label={t('practice.view.sheet')}
      {...handlers}
    >
      {from && to && (
        <div
          className="sheet-music__loop"
          style={{ left: from.left, width: to.right - from.left }}
        />
      )}
      {status === LoadStatus.Loading && (
        <p className="muted sheet-music__status">{t('practice.sheetLoading')}</p>
      )}
      {status === LoadStatus.Error && (
        <p className="notice notice--problem sheet-music__status">{t('practice.sheetError')}</p>
      )}
      <div ref={hostRef} className="sheet-music__host" />
    </div>
  );
}

/** Where each bar is drawn, from OSMD's layout (10 px per unit at 100% zoom). */
function barBoxes(osmd: OpenSheetMusicDisplay): BarBox[] {
  const px = 10 * osmd.zoom;
  return osmd.GraphicSheet.MeasureList.map((staves) => {
    const box = staves.find((measure) => measure)?.PositionAndShape;
    const left = (box?.AbsolutePosition.x ?? 0) * px;
    return { left, right: left + (box?.Size.width ?? 0) * px };
  });
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
