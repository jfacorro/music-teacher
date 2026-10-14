/** One note on a treble or bass staff: a quiz flash card. */
import { useTranslation } from 'react-i18next';
import { noteCardXml, type Clef } from '../../content/musicxml';
import type { Pitch } from '../../theory/pitch';
import { StaticStaff } from './StaticStaff';

export function NoteCard({ pitch, clef }: { pitch: Pitch; clef: Clef }) {
  const { t } = useTranslation('screens');
  return (
    <div className="note-card">
      <StaticStaff xml={noteCardXml(pitch, clef)} label={t('quiz.cardLabel')} />
    </div>
  );
}
