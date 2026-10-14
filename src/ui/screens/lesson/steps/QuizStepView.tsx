import { useTranslation } from 'react-i18next';
import type { QuizStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { NoteQuiz } from '../../../quiz/NoteQuiz';

interface QuizStepViewProps {
  step: QuizStep;
  text: string;
  onResult: (result: StepResult, passed: boolean) => void;
  onContinue: () => void;
}

/** Note-naming flash cards: a note on the staff, play its key. */
export function QuizStepView({ step, text, onResult, onContinue }: QuizStepViewProps) {
  const { t } = useTranslation('screens');
  const passes = (stars: number) => stars >= step.pass.minStars;

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      {step.pass.minStars > 0 && (
        <p className="muted">{t('lesson.passRule', { stars: step.pass.minStars })}</p>
      )}
      <NoteQuiz
        notes={step.notes}
        count={step.count}
        clef={step.clef}
        onFinish={(result) =>
          onResult({ stars: result.stars, accuracy: result.accuracy }, passes(result.stars))
        }
        actions={(result) =>
          passes(result.stars) ? (
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
