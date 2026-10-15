/** Notes on a staff, side by side, for lesson explanations (e.g. the landmark notes). */
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
}

export function StaffPicture({ clef, notes, names }: StaffPictureProps) {
  const { t } = useTranslation('screens');
  const noteNames = useNoteNames();

  const xml = useMemo(() => {
    // Each note a whole note in its own (invisible) bar; on the grand staff, middle C and up go
    // on the treble staff.
    const hand = (pitch: Pitch): Hand =>
      clef === StaffClef.Grand
        ? pitch.midi >= MIDDLE_C
          ? Hand.Right
          : Hand.Left
        : STAVES[clef][0]!;
    const score: Score = {
      tempo: 60,
      timeSignature: [4, 4],
      notes: notes.map((pitch, i) => ({ pitch, start: i * 4, duration: 4, hand: hand(pitch) })),
      measures: notes.map((_, i) => ({ start: i * 4, length: 4 })),
    };
    return scoreToMusicXml(score, {
      hands: STAVES[clef],
      illustration: true,
      noteLabel: names ? (note) => noteNames.name(note.pitch) : undefined,
    }).xml;
  }, [clef, notes, names, noteNames]);

  return (
    <div className="staff-picture">
      <StaticStaff xml={xml} label={t('lesson.staffPicture')} barWidth={3} spacePx={12} />
    </div>
  );
}
