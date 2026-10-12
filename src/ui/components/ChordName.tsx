import { useTranslation } from 'react-i18next';
import { useNoteNames } from '../../i18n/useNoteNames';
import { useLiveInput } from '../../input/liveStore';
import { identifyChord, identifyInterval, rootSpelling } from '../../theory/chords';

/** Names the chord (or interval) formed by the keys held right now. */
export function ChordName() {
  const { t } = useTranslation('theory');
  const held = useLiveInput((s) => s.held);
  const names = useNoteNames();
  const midis = held.map((note) => note.pitch);

  const nameOf = (pc: number) => names.name({ ...rootSpelling(pc), octave: 0 }, { octave: false });

  let text: string | null = null;
  const chord = identifyChord(midis);
  if (chord) {
    const name = t(`chords.${chord.quality}`, { root: nameOf(chord.root) });
    text =
      chord.bass === chord.root ? name : t('slashChord', { chord: name, bass: nameOf(chord.bass) });
  } else {
    const interval = identifyInterval(midis);
    if (interval) text = t(`intervals.${interval}`);
  }

  return (
    <p className="chord-name" aria-live="polite">
      {text}
    </p>
  );
}
