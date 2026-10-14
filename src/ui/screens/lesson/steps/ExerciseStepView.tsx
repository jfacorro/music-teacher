import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExerciseStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { PracticeRun } from '../../practice/PracticeRun';
import { NotationSelect, ViewToggle } from '../../practice/ViewToggle';
import { useSettings } from '../../../../storage/settings';
import { Markings } from '../../../components/Markings';

interface ExerciseStepViewProps {
  step: ExerciseStep;
  text: string;
  /** A finished run's result, and whether it meets the step's pass rule. */
  onResult: (result: StepResult, passed: boolean) => void;
  onContinue: () => void;
}

export function ExerciseStepView({ step, text, onResult, onContinue }: ExerciseStepViewProps) {
  const { t } = useTranslation('screens');
  const [metronome, setMetronome] = useState(step.metronome);
  const [view, setView] = useState(step.view);
  const [notation, setNotation] = useState(
    () => step.notation ?? useSettings.getState().sheetNotation,
  );
  const passes = (stars: number) => stars >= step.pass.minStars;

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <div className="practice__options">
        <Markings markings={step.score.markings ?? []} />
        <ViewToggle view={view} onChange={setView} />
        {view === 'sheet' && <NotationSelect notation={notation} onChange={setNotation} />}
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
        view={view}
        notation={notation}
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
