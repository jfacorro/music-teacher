import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { matchTargets, matchTargetsNear } from '../../../../engine/matchNote';
import type { VocalRange } from '../../../../engine/vocalRange';
import { useMicWhileShown } from '../../../hooks';
import { MatchTheNote } from '../../MatchTheNote';
import { ShortcutButton } from '../../../components/ShortcutButton';
import { ShortcutKey } from '../../../shortcuts';

interface MatchStepViewProps {
  step: MatchStep;
  text: string;
  onResult: (result: StepResult, passed: boolean) => void;
  onContinue: () => void;
}

/** Match the note: sing back notes from around the comfortable one (or the whole range). */
export function MatchStepView({ step, text, onResult, onContinue }: MatchStepViewProps) {
  const { t } = useTranslation('screens');
  useMicWhileShown();
  const passes = (stars: number) => stars >= step.pass.minStars;
  const pick = useCallback(
    (range: VocalRange) =>
      step.within === null
        ? matchTargets(range, step.count)
        : matchTargetsNear(range, step.within, step.count),
    [step],
  );

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <p className="muted">{t('lesson.passRule', { stars: step.pass.minStars })}</p>
      <MatchTheNote
        pick={pick}
        tuner
        intro={t('lesson.match.intro', { count: step.count })}
        onFinish={({ stars, accuracy }) => onResult({ stars, accuracy }, passes(stars))}
        actions={(summary) =>
          passes(summary.stars) ? (
            <ShortcutButton
              shortcut={ShortcutKey.Enter}
              className="button button--primary"
              title={t('lesson.tips.continue')}
              onClick={onContinue}
            >
              {t('lesson.continue')}
            </ShortcutButton>
          ) : null
        }
      />
    </div>
  );
}
