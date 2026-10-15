import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Dynamic,
  DYNAMIC_BANDS,
  dynamicAt,
  type HairpinKind,
  hairpinAt,
  type ScoreDynamics,
} from '../../../engine/dynamics';
import { markingText } from '../../../engine/markings';
import type { Transport } from '../../../engine/transport';
import { useLiveInput } from '../../../input/liveStore';
import { InputSource, NoteEventType } from '../../../input/types';
import { LoudnessMeter } from '../../components/LoudnessMeter';
import { useAnimationFrame } from '../../hooks';

/**
 * While playing: how loud the music should be now (the level, or a crescendo or diminuendo)
 * and, on a MIDI keyboard, how hard the last note was played against that level.
 */
export function DynamicsNow({
  dynamics,
  transport,
}: {
  dynamics: ScoreDynamics;
  transport: Transport;
}) {
  const { t } = useTranslation('screens');
  const { t: tTheory } = useTranslation('theory');
  const [now, setNow] = useState<{ dynamic: Dynamic | null; hairpin: HairpinKind | null }>({
    dynamic: null,
    hairpin: null,
  });
  useAnimationFrame(() => {
    // The first notes may come before the first mark: show that one meanwhile.
    const beat = Math.max(transport.position(), dynamics.marks[0]?.beat ?? 0);
    const dynamic = dynamicAt(dynamics, beat);
    const hairpin = hairpinAt(dynamics, beat)?.kind ?? null;
    if (dynamic !== now.dynamic || hairpin !== now.hairpin) setNow({ dynamic, hairpin });
  });
  const last = useLiveInput((s) =>
    s.recent.find((event) => event.type === NoteEventType.On && event.source === InputSource.Midi),
  );

  if (!now.dynamic && !now.hairpin) return null;
  return (
    <div className="dynamics-now" title={t('practice.dynamics.nowTip')}>
      {now.hairpin ? (
        <span>
          <strong className="dynamics-now__mark">
            {t(`practice.dynamics.short.${now.hairpin}`)}
          </strong>{' '}
          {tTheory(`hairpins.${now.hairpin}`)}
        </span>
      ) : (
        now.dynamic && (
          <span>
            <strong className="dynamics-now__mark">{markingText(now.dynamic)}</strong>{' '}
            {tTheory(`dynamicNames.${now.dynamic}`)}
          </span>
        )
      )}
      {last && (
        <LoudnessMeter
          band={now.dynamic && !now.hairpin ? DYNAMIC_BANDS[now.dynamic] : undefined}
          values={[last.velocity]}
        />
      )}
    </div>
  );
}
