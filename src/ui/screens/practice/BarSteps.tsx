import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type PracticeSession, SessionStatus } from '../../../engine/session';
import type { Transport } from '../../../engine/transport';
import { useAnimationFrame } from '../../hooks';
import { ICONS } from '../../icons';

/**
 * Back and forward a bar (also ← and →), around the bar playing now. A run that moves goes on
 * as practice: it isn't scored.
 */
export function BarSteps({
  session,
  transport,
  status,
}: {
  session: PracticeSession;
  transport: Transport;
  status: SessionStatus;
}) {
  const { t } = useTranslation('screens');
  const [bar, setBar] = useState(() => session.barAt(transport.position()));
  useAnimationFrame(() => {
    const now = session.barAt(transport.position());
    if (now !== bar) setBar(now);
  });
  const finished = status === SessionStatus.Finished;
  const back = t('practice.bars.back');
  const forward = t('practice.bars.forward');

  return (
    <span className="bar-steps">
      <button
        type="button"
        className="button button--icon"
        onClick={() => session.back()}
        disabled={finished || status === SessionStatus.Ready}
        aria-label={back}
        aria-keyshortcuts="ArrowLeft"
        title={t('practice.tips.withKey', { action: back, key: t('practice.keys.left') })}
      >
        <span aria-hidden="true">{ICONS.barBack}</span>
      </button>
      <span className="bar-steps__now">
        {t('practice.bars.now', { bar: bar + 1, count: session.score.measures.length })}
      </span>
      <button
        type="button"
        className="button button--icon"
        onClick={() => session.forward()}
        disabled={finished || bar >= session.bars.last}
        aria-label={forward}
        aria-keyshortcuts="ArrowRight"
        title={t('practice.tips.withKey', { action: forward, key: t('practice.keys.right') })}
      >
        <span aria-hidden="true">{ICONS.barForward}</span>
      </button>
      <kbd className="key-hint" aria-hidden="true">
        {t('practice.keys.left')} {t('practice.keys.right')}
      </kbd>
    </span>
  );
}
