import { useTranslation } from 'react-i18next';
import { useNoteNames } from '../../i18n/useNoteNames';
import { useLiveInput } from '../../input/liveStore';
import { pitchFromMidi } from '../../theory/pitch';

/** The keys held right now, as large name chips. */
export function HeldNotesDisplay({ showVelocity = false }: { showVelocity?: boolean }) {
  const { t } = useTranslation();
  const held = useLiveInput((s) => s.held);
  const names = useNoteNames();

  return (
    <div className="held-notes" aria-live="polite">
      {held.length === 0 ? (
        <span className="muted">{t('heldNotes.none')}</span>
      ) : (
        held.map((note) => (
          <span key={note.pitch} className="held-note">
            <span className="held-note__name">
              {names.name(pitchFromMidi(note.pitch), { octave: true })}
            </span>
            {showVelocity && (
              <span className="held-note__detail">
                {t('heldNotes.velocity', { velocity: note.velocity })}
              </span>
            )}
          </span>
        ))
      )}
    </div>
  );
}
