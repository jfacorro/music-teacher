import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExerciseStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { PracticeRun } from '../../practice/PracticeRun';
import { NotationSelect, ViewToggle } from '../../practice/ViewToggle';
import { useSettings } from '../../../../storage/settings';
import { Markings } from '../../../components/Markings';
import { ScoreView } from '../../../../content/lessons/lesson';
import type { Summary } from '../../../../engine/scoring';

interface ExerciseStepViewProps {
  step: ExerciseStep;
  text: string;
  /** A finished run's result, and whether it meets the step's pass rule. */
  onResult: (result: StepResult, passed: boolean) => void;
  onContinue: () => void;
  /** Where its latest finished run is kept (see PracticeRun). */
  recordingKey?: string;
}

export function ExerciseStepView({
  step,
  text,
  onResult,
  onContinue,
  recordingKey,
}: ExerciseStepViewProps) {
  const { t } = useTranslation('screens');
  const [metronome, setMetronome] = useState(step.metronome);
  const [view, setView] = useState(step.view);
  /** Playing the last run back: the metronome setting waits. */
  const [listening, setListening] = useState(false);
  const [notation, setNotation] = useState(
    () => step.notation ?? useSettings.getState().sheetNotation,
  );
  // Without a MIDI keyboard there are no dynamics to check: the notes decide.
  const passes = (summary: Summary) =>
    summary.stars >= step.pass.minStars &&
    (!step.pass.dynamics || summary.dynamics === null || summary.dynamics.ok) &&
    (!step.pass.touch || summary.touch === null || summary.touch.ok);

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <div className="practice__options">
        <Markings markings={step.score.markings ?? []} />
        <ViewToggle view={view} onChange={setView} />
        {view === ScoreView.Sheet && <NotationSelect notation={notation} onChange={setNotation} />}
        <label className={listening ? 'checkbox is-set-aside' : 'checkbox'} inert={listening}>
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
        {step.pass.dynamics && <span className="muted">{t('lesson.passDynamics')}</span>}
        {step.pass.touch && <span className="muted">{t('lesson.passTouch')}</span>}
      </div>
      <PracticeRun
        score={step.score}
        mode={step.mode}
        hands={step.hands}
        metronome={metronome}
        view={view}
        notation={notation}
        recordingKey={recordingKey}
        onListeningChange={setListening}
        onFinish={(summary) =>
          onResult({ stars: summary.stars, accuracy: summary.accuracy }, passes(summary))
        }
        resultsActions={(summary) =>
          passes(summary) ? (
            <button
              type="button"
              className="button button--primary"
              title={t('lesson.tips.continue')}
              onClick={onContinue}
            >
              {t('lesson.continue')}
            </button>
          ) : null
        }
      />
    </div>
  );
}
