/**
 * Notes on a staff, side by side, for lesson explanations (e.g. the landmark notes); or a few
 * bars of music, to show a mark.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StaffClef } from '../../content/lessons';
import { scoreToMusicXml } from '../../content/musicxml';
import { Hand, type Score } from '../../engine/score';
import { useNoteNames } from '../../i18n/useNoteNames';
import { MIDDLE_C, type Pitch } from '../../theory/pitch';
import { StaticStaff } from './StaticStaff';

const STAVES: Record<StaffClef, Hand[]> = {
  treble: [Hand.Right],
  bass: [Hand.Left],
  grand: [Hand.Right, Hand.Left],
};

interface StaffPictureProps {
  clef: StaffClef;
  notes: readonly Pitch[];
  /** Write each note's name under it. */
  names: boolean;
  /** All in one bar, so accidentals carry on (see StaffNotes). */
  bar?: boolean;
  /** The key signature at the start. */
  keyFifths?: number;
  /** The notes sound together: a chord, in one bar. */
  together?: boolean;
}

/** Notes in one bar: quarter notes, so up to four fit. */
const BAR_BEATS = 4;
/** A bar's width for one note (see StaticStaff). */
const NOTE_WIDTH = 3;

export function StaffPicture({
  clef,
  notes,
  names,
  bar = false,
  keyFifths,
  together = false,
}: StaffPictureProps) {
  const { t } = useTranslation('screens');
  const noteNames = useNoteNames();

  const xml = useMemo(() => {
    // Each note a whole note in its own (invisible) bar, or quarter notes sharing bars; on the
    // grand staff, middle C and up go on the treble staff.
    const hand = (pitch: Pitch): Hand =>
      clef === StaffClef.Grand
        ? pitch.midi >= MIDDLE_C
          ? Hand.Right
          : Hand.Left
        : STAVES[clef][0]!;
    const score: Score = {
      tempo: 60,
      timeSignature: [4, 4],
      ...(keyFifths !== undefined && { keyFifths }),
      notes: notes.map((pitch, i) => ({
        pitch,
        start: together ? 0 : bar ? i : i * BAR_BEATS,
        duration: bar ? 1 : BAR_BEATS,
        hand: hand(pitch),
      })),
      measures: Array.from(
        {
          length: together
            ? 1
            : Math.max(1, bar ? Math.ceil(notes.length / BAR_BEATS) : notes.length),
        },
        (_, i) => ({ start: i * BAR_BEATS, length: BAR_BEATS }),
      ),
    };
    return scoreToMusicXml(score, {
      hands: STAVES[clef],
      illustration: true,
      noteLabel: names ? (note) => noteNames.name(note.pitch) : undefined,
    }).xml;
  }, [clef, notes, names, noteNames, bar, keyFifths, together]);

  return (
    <div className="staff-picture">
      <StaticStaff
        xml={xml}
        label={t('lesson.staffPicture')}
        // As wide per note either way.
        barWidth={bar ? NOTE_WIDTH * Math.min(notes.length, BAR_BEATS) : NOTE_WIDTH}
        spacePx={12}
      />
    </div>
  );
}

/** A few bars of music as written, with their marks; as wide per note as a staff picture. */
export function MusicPicture({ score }: { score: Score }) {
  const { t } = useTranslation('screens');
  const xml = useMemo(
    () =>
      scoreToMusicXml(score.form?.written ?? score, {
        hands: STAVES[StaffClef.Grand].filter((hand) =>
          score.notes.some((note) => note.hand === hand),
        ),
        handLabel: (hand) => t(`practice.crossedHand.${hand}`),
      }).xml,
    [score, t],
  );
  const mostInABar = Math.max(
    BAR_BEATS,
    ...score.measures.map(
      (measure) =>
        new Set(
          score.notes
            .filter(
              (note) => note.start >= measure.start && note.start < measure.start + measure.length,
            )
            .map((note) => note.start),
        ).size,
    ),
  );
  return (
    <div className="staff-picture">
      <StaticStaff
        xml={xml}
        label={t('lesson.staffPicture')}
        barWidth={NOTE_WIDTH * mostInABar}
        spacePx={12}
        timeSignature={score.timeSignature}
      />
    </div>
  );
}
