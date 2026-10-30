import { useTranslation } from 'react-i18next';
import type { QuestionStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { ShortcutButton } from '../../../components/ShortcutButton';
import { QuestionQuiz } from '../../../quiz/QuestionQuiz';
import { ShortcutKey } from '../../../shortcuts';

interface QuestionStepViewProps {
  step: QuestionStep;
  text: string;
  onResult: (result: StepResult, passed: boolean) => void;
  onContinue: () => void;
}

/** Theory questions: two notes, and a choice of answers. */
export function QuestionStepView({ step, text, onResult, onContinue }: QuestionStepViewProps) {
  const { t } = useTranslation('screens');
  const passes = (stars: number) => stars >= step.pass.minStars;

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      {step.pass.minStars > 0 && (
        <p className="muted">{t('lesson.passRule', { stars: step.pass.minStars })}</p>
      )}
      <QuestionQuiz
        questions={step.questions}
        show={step.show}
        count={step.count}
        onFinish={(result) =>
          onResult({ stars: result.stars, accuracy: result.accuracy }, passes(result.stars))
        }
        actions={(result) =>
          passes(result.stars) ? (
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
