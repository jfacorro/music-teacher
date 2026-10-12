import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SongId } from '../../../content/songs';
import { scoreEnd, type Score, type ScoreNote } from '../../../engine/score';
import { Transport } from '../../../engine/transport';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { screenKeyDown, screenKeyUp } from '../../../input/dev/screenInput';
import { pitchFromMidi } from '../../../theory/pitch';
import { useActiveNotes, usePressedKeys, useTransportState } from '../../hooks';
import { FallingNotes } from '../../keyboard/FallingNotes';
import { keyboardLayout, rangeForNotes } from '../../keyboard/layout';
import { PianoKeyboard, type ExpectedKey } from '../../keyboard/PianoKeyboard';

const SECONDS_VISIBLE = 3;
const LEAD_IN_SCREENS = 0.8;

export function PracticeView({ songId, score }: { songId: SongId; score: Score }) {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const names = useNoteNames();

  // Start with the first notes near the top, so they're visible before pressing Play
  // and fall in from there.
  const leadIn = (LEAD_IN_SCREENS * SECONDS_VISIBLE * score.tempo) / 60;
  const [transport] = useState(() => {
    const created = new Transport(score.tempo);
    created.seek(-leadIn);
    return created;
  });
  const { playing } = useTransportState(transport);
  useEffect(() => () => transport.pause(), [transport]);

  const layout = useMemo(
    () => keyboardLayout(...rangeForNotes(score.notes.map((note) => note.pitch.midi))),
    [score],
  );

  const active = useActiveNotes(score, transport);
  const expected = useMemo(
    () =>
      new Map<number, ExpectedKey>(
        active.map((note) => [note.pitch.midi, { hand: note.hand, finger: note.finger }]),
      ),
    [active],
  );
  const pressed = usePressedKeys();

  const keyLabel = useCallback(
    (midi: number) => names.name(pitchFromMidi(midi), { octave: false }),
    [names],
  );
  // Falling notes use the score's own spelling (a written D♭ stays D♭).
  const noteLabel = useCallback(
    (note: ScoreNote) => names.name(note.pitch, { octave: false }),
    [names],
  );

  const restart = () => transport.seek(-leadIn);
  const togglePlay = () => {
    if (playing) {
      transport.pause();
      return;
    }
    if (transport.position() >= scoreEnd(score)) restart();
    transport.play();
  };

  return (
    <section className="screen practice">
      <header className="practice__header">
        <div>
          <h1>{ts(`${songId}.title`)}</h1>
          <p className="muted">{ts(`${songId}.composer`)}</p>
        </div>
        <div className="practice__controls">
          <button type="button" className="button button--primary" onClick={togglePlay}>
            {playing ? t('practice.pause') : t('practice.play')}
          </button>
          <button type="button" className="button" onClick={restart}>
            {t('practice.restart')}
          </button>
        </div>
      </header>
      <p className="muted">{t('practice.hint')}</p>

      <div className="practice__stage">
        <FallingNotes
          score={score}
          transport={transport}
          layout={layout}
          secondsVisible={SECONDS_VISIBLE}
          labelFor={noteLabel}
        />
        <PianoKeyboard
          layout={layout}
          pressed={pressed}
          expected={expected}
          labels="white"
          labelFor={keyLabel}
          onKeyDown={screenKeyDown}
          onKeyUp={screenKeyUp}
        />
      </div>
    </section>
  );
}
