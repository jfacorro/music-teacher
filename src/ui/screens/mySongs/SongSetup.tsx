import { useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ImportedMusic,
  type ImportedTrack,
  trackRange,
  TrackHand,
} from '../../../content/loaders/importedMusic';
import {
  type ImportOptions,
  importedScore,
  TEMPO_MAX,
  TEMPO_MIN,
  TRANSPOSE_LIMIT,
  transposeKey,
} from '../../../content/loaders/importedScore';
import { formatNumber } from '../../../i18n/format';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { pitchFromMidi, pitchOf } from '../../../theory/pitch';
import { valuesOf } from '../../../lib/values';

/** What the learner decides about an imported song. */
export interface SongDetails {
  title: string;
  composer: string | null;
  options: ImportOptions;
}

interface SongSetupProps {
  music: ImportedMusic;
  fileName: string;
  initial: SongDetails;
  saveLabel: string;
  onSave: (details: SongDetails) => Promise<void>;
  onCancel: () => void;
  cancelLabel: string;
  /** More buttons after save and cancel (e.g. delete). */
  children?: ReactNode;
}

const TRACK_HANDS = valuesOf(TrackHand);
const TRANSPOSITIONS = Array.from(
  { length: TRANSPOSE_LIMIT * 2 + 1 },
  (_, i) => i - TRANSPOSE_LIMIT,
);
const MIDDLE_C_NOTE = pitchOf('C4');

/**
 * An imported song's title, who plays each track, transposition and tempo, with what the file
 * has that the practice score simplifies.
 */
export function SongSetup({
  music,
  fileName,
  initial,
  saveLabel,
  onSave,
  onCancel,
  cancelLabel,
  children,
}: SongSetupProps) {
  const { t, i18n } = useTranslation('screens');
  const names = useNoteNames();
  const id = useId();
  const [title, setTitle] = useState(initial.title);
  const [composer, setComposer] = useState(initial.composer ?? '');
  const [hands, setHands] = useState(initial.options.hands);
  const [transpose, setTranspose] = useState(initial.options.transpose);
  const [tempoText, setTempoText] = useState(String(initial.options.tempo));
  const [saving, setSaving] = useState(false);

  const tempo = Number(tempoText);
  const tempoValid = Number.isInteger(tempo) && tempo >= TEMPO_MIN && tempo <= TEMPO_MAX;
  const options: ImportOptions = { hands, transpose, tempo: tempoValid ? tempo : music.tempo };
  const { score, outOfRange } = useMemo(
    () => importedScore(music, { hands, transpose, tempo: music.tempo }),
    [music, hands, transpose],
  );
  const canSave = title.trim() !== '' && tempoValid && score !== null && !saving;

  const trackName = (track: ImportedTrack, index: number) => {
    const name = track.name ?? t('mySongs.setup.trackNumber', { number: index + 1 });
    return track.staff ? t('mySongs.setup.trackStaff', { name, staff: track.staff }) : name;
  };
  const range = (track: ImportedTrack) => {
    const { lowest, highest } = trackRange(track);
    const keyFifths = transposeKey(music.keyFifths, transpose);
    // Notes moved past MIDI's range are left out of the score; here they just stop at the end.
    const name = (midi: number) =>
      names.name(pitchFromMidi(Math.min(127, Math.max(0, midi + transpose)), { keyFifths }), {
        octave: true,
      });
    return `${name(lowest)}–${name(highest)}`;
  };
  const transposition = (semitones: number) =>
    semitones === 0
      ? t('mySongs.setup.originalKey')
      : t('mySongs.setup.semitones', {
          count: semitones,
          signed: new Intl.NumberFormat(i18n.language, { signDisplay: 'exceptZero' }).format(
            semitones,
          ),
        });

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), composer: composer.trim() || null, options });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="card song-setup"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="muted">{t('mySongs.setup.file', { fileName })}</p>
      <div className="field">
        <label htmlFor={`${id}-title`}>{t('mySongs.setup.title')}</label>
        <input
          id={`${id}-title`}
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-composer`}>{t('mySongs.setup.composer')}</label>
        <input
          id={`${id}-composer`}
          type="text"
          maxLength={200}
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
        />
      </div>

      <h2>{t('mySongs.setup.tracks')}</h2>
      <p className="muted">{t('mySongs.setup.tracksHint')}</p>
      <div className="table-scroll">
        <table className="events song-setup__tracks">
          <thead>
            <tr>
              <th scope="col">{t('mySongs.setup.track')}</th>
              <th scope="col">{t('mySongs.setup.notes')}</th>
              <th scope="col">{t('mySongs.setup.range')}</th>
              <th scope="col">{t('mySongs.setup.hand')}</th>
            </tr>
          </thead>
          <tbody>
            {music.tracks.map((track, index) => (
              <tr key={index}>
                <td>{trackName(track, index)}</td>
                <td>{formatNumber(track.notes.length, i18n.language)}</td>
                <td>{range(track)}</td>
                <td>
                  <select
                    aria-label={t('mySongs.setup.handFor', { track: trackName(track, index) })}
                    value={hands[index] ?? TrackHand.None}
                    onChange={(e) =>
                      setHands(
                        hands.map((hand, i) =>
                          i === index ? (e.target.value as TrackHand) : hand,
                        ),
                      )
                    }
                  >
                    {TRACK_HANDS.map((hand) => (
                      <option key={hand} value={hand}>
                        {t(`mySongs.setup.hands.${hand}`, {
                          c: names.name(MIDDLE_C_NOTE, { octave: false }),
                        })}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="song-setup__row">
        <div className="field">
          <label htmlFor={`${id}-transpose`}>{t('mySongs.setup.transpose')}</label>
          <select
            id={`${id}-transpose`}
            value={transpose}
            onChange={(e) => setTranspose(Number(e.target.value))}
          >
            {TRANSPOSITIONS.map((semitones) => (
              <option key={semitones} value={semitones}>
                {transposition(semitones)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-tempo`}>{t('mySongs.setup.tempo')}</label>
          <input
            id={`${id}-tempo`}
            type="number"
            inputMode="numeric"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            step={1}
            value={tempoText}
            aria-invalid={!tempoValid}
            aria-describedby={`${id}-tempo-hint`}
            onChange={(e) => setTempoText(e.target.value)}
          />
          <span id={`${id}-tempo-hint`} className={tempoValid ? 'muted' : 'field__error'}>
            {tempoValid
              ? t('mySongs.setup.tempoFromFile', { bpm: music.tempo })
              : t('mySongs.setup.tempoRange', { min: TEMPO_MIN, max: TEMPO_MAX })}
          </span>
        </div>
      </div>

      {(music.warnings.length > 0 || outOfRange > 0) && (
        <div className="notice song-setup__warnings">
          <strong>{t('mySongs.warnings.heading')}</strong>
          <ul>
            {music.warnings.map((warning) => (
              <li key={warning}>{t(`mySongs.warnings.${warning}`)}</li>
            ))}
            {outOfRange > 0 && <li>{t('mySongs.warnings.outOfRange', { count: outOfRange })}</li>}
          </ul>
        </div>
      )}

      {score ? (
        <p className="muted">
          {t('mySongs.setup.summary', {
            notes: score.notes.length,
            bars: score.measures.length,
          })}
        </p>
      ) : (
        <p className="notice notice--problem" role="alert">
          {t('mySongs.setup.noHands')}
        </p>
      )}

      <div className="button-row">
        <button type="submit" className="button button--primary" disabled={!canSave}>
          {saveLabel}
        </button>
        <button type="button" className="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        {children}
      </div>
    </form>
  );
}
