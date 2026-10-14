import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RhythmStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { PracticeRun } from '../../practice/PracticeRun';
import { ViewToggle } from '../../practice/ViewToggle';

interface RhythmStepViewProps {
  step: RhythmStep;
  text: string;
  onResult: (result: StepResult, passed: boolean) => void;
  onContinue: () => void;
}

/** Tap along with a rhythm: any key counts, only the timing is graded. */
export function RhythmStepView({ step, text, onResult, onContinue }: RhythmStepViewProps) {
  const { t } = useTranslation('screens');
  const [metronome, setMetronome] = useState(step.metronome);
  const [view, setView] = useState(step.view);
  const passes = (stars: number) => stars >= step.pass.minStars;

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <div className="practice__options">
        <ViewToggle view={view} onChange={setView} />
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
        mode="tempo"
        hands="both"
        metronome={metronome}
        view={view}
        notation="plain"
        rhythm
        onFinish={(summary) =>
          onResult({ stars: summary.stars, accuracy: summary.accuracy }, passes(summary.stars))
        }
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
