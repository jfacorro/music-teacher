/**
 * Sheet music view (PLAN.md §2.1): the score rendered by OpenSheetMusicDisplay on one
 * horizontal line, with a cursor that follows the transport and scrolls along, and notes
 * colored by how they went (same colors as the falling notes).
 *
 * Music with repeats is drawn as written, while the transport plays it unrolled: the cursor goes
 * back to the repeat's start when the music does, each note shows how it went the last time it
 * was played, and bars are chosen and shaded as written (engine/form.ts).
 *
 * A song's harmony (milestone 7.4) goes in a row above the music, each chord where its beat is
 * drawn, with the sections' letters, and the cadences in a row below.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { GraphicalNote, OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { DIVISIONS, noteKey, scoreToMusicXml } from '../../content/musicxml';
import { SheetNotation } from '../../content/lessons';
import { playedMeasureOf, writtenBeat, writtenMeasureOf } from '../../engine/form';
import { Hand, type Score, type ScoreNote } from '../../engine/score';
import { HandFilter, type LoopRange } from '../../engine/session';
import { useNoteNames } from '../../i18n/useNoteNames';
import { useSolfa } from '../../i18n/useSolfa';
import type { Transport } from '../../engine/transport';
import { useBarSelection } from '../barSelection';
import { readCssColors, useColorScheme } from '../canvas';
import { useAnimationFrame } from '../hooks';
import { NoteStyle } from '../keyboard/styles';
import { LoadStatus } from '../loadStatus';
import type { SheetHarmony } from './harmony';

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
  /** The language of the words to write under the notes that have them (none by default). */
  lyrics?: string;
  /** A song's chords, sections and cadences, to show with the music. */
  harmony?: SheetHarmony | null;
}

/** Where a bar is drawn: px from the left of the sheet. */
interface BarBox {
  left: number;
  right: number;
}

/** Where the notes on a beat are drawn: px from the left of the sheet. */
interface BeatLeft {
  beat: number;
  x: number;
}

/** Where the bars and the beats are drawn, once the music is. */
interface Layout {
  bars: BarBox[];
  beats: BeatLeft[];
}

const COLORS = {
  music: '--text',
  cursor: '--accent',
  played: '--note-played',
  missed: '--key-wrong',
  muted: '--muted',
  partly: '--pending',
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
  lyrics,
  harmony = null,
}: SheetMusicProps) {
  const { t } = useTranslation('screens');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendered = useRef<Rendered | null>(null);
  const [status, setStatus] = useState<LoadStatus>(LoadStatus.Loading);
  const [{ bars, beats }, setLayout] = useState<Layout>({ bars: [], beats: [] });
  const scheme = useColorScheme();
  const names = useNoteNames();
  const solfa = useSolfa();

  const { form } = score;
  // Drawn as written: repeats once, with their signs.
  const written = form?.written ?? score;
  const music = useMemo(() => {
    if (rhythm) return scoreToMusicXml(written, { rhythm: true });
    const staves: Hand[] | undefined =
      notation === SheetNotation.Grand
        ? [Hand.Right, Hand.Left]
        : hands === HandFilter.Both
          ? undefined
          : [hands];
    return scoreToMusicXml(written, {
      hands: staves,
      noteLabel:
        notation === SheetNotation.Names
          ? (note) => names.name(note.pitch, { octave: false })
          : notation === SheetNotation.Syllables
            ? (note) => solfa(note.pitch, written.keyFifths)
            : undefined,
      handLabel: (hand) => t(`practice.crossedHand.${hand}`),
      ...(lyrics && { lyrics }),
    });
  }, [written, notation, hands, names, solfa, rhythm, t, lyrics]);

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
      // The cursor follows the music as written; repeats are followed by the played position.
      osmd.EngravingRules.CursorIgnoreRepetitions = true;
      osmd.zoom = ZOOM;
      osmd.render();
      osmd.cursor.show();
      rendered.current = { osmd, graphics: indexGraphics(osmd, notes), applied: new Map(), colors };
      setLayout({ bars: barBoxes(osmd), beats: beatLefts(osmd) });
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
    // A written note played more than once shows how it went the last time.
    const styleOfWritten = (note: ScoreNote) => {
      const copies = form?.copies.get(note);
      if (!copies) return styleOf?.(note);
      const styles = copies.map((copy) => styleOf?.(copy));
      return (
        styles.findLast((style) => style !== undefined && style !== NoteStyle.Muted) ?? styles[0]
      );
    };
    for (const [note, graphicals] of sheet.graphics) {
      const style = styleOfWritten(note);
      const color =
        style === NoteStyle.Played
          ? sheet.colors.played
          : style === NoteStyle.Missed
            ? sheet.colors.missed
            : style === NoteStyle.Muted
              ? sheet.colors.muted
              : style === NoteStyle.Partly
                ? sheet.colors.partly
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
  }, [styleOf, outcomesVersion, status, form]);

  // Keep the cursor on the notes being played, and scroll it into view when it moves or the
  // music starts. Otherwise the sheet stays where it is, so it can be read ahead (before starting,
  // or paused).
  const wasPlaying = useRef(false);
  useAnimationFrame(() => {
    const sheet = rendered.current;
    const scroller = scrollerRef.current;
    if (!sheet || !scroller) return;
    const cursor = sheet.osmd.cursor;
    const beat = form ? writtenBeat(form, transport.position()) : transport.position();
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
  // Bars are chosen as written, and practiced where they're first played.
  const selectPlayed =
    onSelectBars &&
    (form
      ? (range: LoopRange) => {
          const first = playedMeasureOf(form, score, range.first);
          const last = playedMeasureOf(form, score, range.last);
          onSelectBars({ first: Math.min(first, last), last: Math.max(first, last) });
        }
      : onSelectBars);
  const { selection, handlers } = useBarSelection(selectPlayed, barAt);
  // The bars repeated, shaded where they're written.
  const loopWritten =
    loop && form
      ? (() => {
          const bars = score.measures
            .slice(loop.first, loop.last + 1)
            .map((measure) => writtenMeasureOf(form, measure));
          return { first: Math.min(...bars), last: Math.max(...bars) };
        })()
      : loop;
  const shaded = selection ?? loopWritten ?? null;
  const from = shaded && bars[shaded.first];
  const to = shaded && bars[shaded.last];
  const laidOut = harmony && status === LoadStatus.Ready && bars.length > 0;

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
      {laidOut &&
        harmony.sections.map(({ measure }) => (
          <div
            key={measure}
            className="sheet-music__section-line"
            style={{ left: bars[measure]?.left }}
          />
        ))}
      {laidOut && (
        <div className="sheet-music__harmony">
          {harmony.sections.map(({ measure, name }) => (
            <span
              key={measure}
              className="sheet-music__section"
              style={{ left: bars[measure]?.left }}
            >
              {name}
            </span>
          ))}
          {harmony.chords.map(({ beat, numeral, name }) => (
            <span key={beat} className="sheet-music__chord" style={{ left: xOfBeat(beats, beat) }}>
              <span className="sheet-music__numeral">{numeral}</span>
              <span className="sheet-music__chord-name">{name}</span>
            </span>
          ))}
        </div>
      )}
      {status === LoadStatus.Loading && (
        <p className="muted sheet-music__status">{t('practice.sheetLoading')}</p>
      )}
      {status === LoadStatus.Error && (
        <p className="notice notice--problem sheet-music__status">{t('practice.sheetError')}</p>
      )}
      <div ref={hostRef} className="sheet-music__host" />
      {laidOut && harmony.cadences.length > 0 && (
        <div className="sheet-music__cadences">
          {harmony.cadences.map(({ measure, label }) => {
            const bar = bars[measure];
            return (
              bar && (
                <span
                  key={measure}
                  className="sheet-music__cadence"
                  style={{ left: (bar.left + bar.right) / 2 }}
                >
                  {label}
                </span>
              )
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Where each beat with notes is drawn, from OSMD's layout, in order. */
function beatLefts(osmd: OpenSheetMusicDisplay): BeatLeft[] {
  const px = 10 * osmd.zoom;
  const lefts = new Map<number, number>();
  for (const measures of osmd.GraphicSheet.MeasureList) {
    for (const measure of measures) {
      for (const entry of measure?.staffEntries ?? []) {
        const beat = Math.round(entry.getAbsoluteTimestamp().RealValue * 4 * DIVISIONS) / DIVISIONS;
        const x = entry.PositionAndShape.AbsolutePosition.x * px;
        lefts.set(beat, Math.min(x, lefts.get(beat) ?? Infinity));
      }
    }
  }
  return [...lefts].map(([beat, x]) => ({ beat, x })).sort((a, b) => a.beat - b.beat);
}

/** Where `beat` is drawn: on its notes, or between the notes around it when it has none. */
function xOfBeat(beats: readonly BeatLeft[], beat: number): number {
  const after = beats.findIndex((b) => b.beat >= beat - 1e-6);
  if (after < 0) return beats.at(-1)?.x ?? 0;
  const next = beats[after]!;
  const before = beats[after - 1];
  if (Math.abs(next.beat - beat) < 1e-6 || !before) return next.x;
  return before.x + ((beat - before.beat) / (next.beat - before.beat)) * (next.x - before.x);
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
