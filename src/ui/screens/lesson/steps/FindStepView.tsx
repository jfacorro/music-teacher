import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FindStep } from '../../../../content/lessons';
import type { KeyMark } from '../../../../engine/session';
import { subscribeNotes } from '../../../../input/bus';
import { useLiveInput } from '../../../../input/liveStore';
import type { ExpectedKey } from '../../../keyboard/PianoKeyboard';
import { StepKeyboard } from './StepKeyboard';

interface FindStepViewProps {
  step: FindStep;
  text: string;
  onDone: () => void;
}

/** "Press these keys": each target turns green once played; any order. */
export function FindStepView({ step, text, onDone }: FindStepViewProps) {
  const { t } = useTranslation('screens');
  const targets = useMemo(() => new Set(step.notes.map((pitch) => pitch.midi)), [step]);
  const [found, setFound] = useState<ReadonlySet<number>>(new Set());
  const complete = found.size === targets.size;

  useEffect(
    () =>
      subscribeNotes((event) => {
        if (event.type !== 'on' || !targets.has(event.pitch)) return;
        setFound((prev) => (prev.has(event.pitch) ? prev : new Set(prev).add(event.pitch)));
      }),
    [targets],
  );

  const reported = useRef(false);
  useEffect(() => {
    if (complete && !reported.current) {
      reported.current = true;
      onDone();
    }
  }, [complete, onDone]);

  // Keys still to find are highlighted; held keys show whether they're one of them.
  const highlight = useMemo(
    () =>
      new Map<number, ExpectedKey>(
        [...targets].filter((midi) => !found.has(midi)).map((midi) => [midi, { hand: 'R' }]),
      ),
    [targets, found],
  );
  const held = useLiveInput((s) => s.held);
  const marks = useMemo(
    () =>
      new Map<number, KeyMark>(
        held.map((note) => [note.pitch, targets.has(note.pitch) ? 'correct' : 'wrong']),
      ),
    [held, targets],
  );

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <p className={complete ? 'notice notice--ok' : 'muted'} role="status">
        {complete
          ? t('lesson.allFound')
          : t('lesson.findProgress', { found: found.size, total: targets.size })}
      </p>
      <StepKeyboard range={step.range} highlight={highlight} completed={found} marks={marks} />
    </div>
  );
}
