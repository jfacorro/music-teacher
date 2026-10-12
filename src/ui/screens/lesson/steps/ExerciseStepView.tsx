import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExerciseStep } from '../../../../content/lessons';
import { PracticeRun } from '../../practice/PracticeRun';

interface ExerciseStepViewProps {
  step: ExerciseStep;
  text: string;
  /** Stars earned in a finished run, and whether that meets the step's pass rule. */
  onResult: (stars: number, passed: boolean) => void;
  onContinue: () => void;
}

export function ExerciseStepView({ step, text, onResult, onContinue }: ExerciseStepViewProps) {
  const { t } = useTranslation('screens');
  const [metronome, setMetronome] = useState(step.metronome);
  const passes = (stars: number) => stars >= step.pass.minStars;

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <div className="practice__options">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={metronome}
            onChange={(e) => setMetronome(e.target.checked)}
          />
          {t('practice.metronome')}
        </label>
        {step.pass.minStars > 0 && (
          <span className="muted">{t('lesson.passRule', { stars: step.pass.minStars })}</span>
        )}
      </div>
      <PracticeRun
        score={step.score}
        mode={step.mode}
        hands={step.hands}
        metronome={metronome}
        onFinish={(summary) => onResult(summary.stars, passes(summary.stars))}
        resultsActions={(summary) =>
          passes(summary.stars) ? (
            <button type="button" className="button button--primary" onClick={onContinue}>
              {t('lesson.continue')}
            </button>
          ) : null
        }
      />
    </div>
  );
}
