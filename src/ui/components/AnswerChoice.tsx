import { useTranslation } from 'react-i18next';
import { TheoryAnswer } from '../../content/courses';
import { updateSettings, useSettings } from '../../storage/settings';

const ANSWERS: readonly TheoryAnswer[] = Object.values(TheoryAnswer);

/** How Theory's questions are answered: playing or singing (PLAN.md milestone 7.1). */
export function AnswerChoice() {
  const { t } = useTranslation('screens');
  const answer = useSettings((s) => s.theoryAnswer ?? TheoryAnswer.Play);
  return (
    <div className="answer-choice">
      <span className="muted">{t('course.answerBy')}</span>
      <div className="segmented" role="radiogroup" aria-label={t('course.answerBy')}>
        {ANSWERS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={answer === value}
            className={answer === value ? 'segmented__option is-selected' : 'segmented__option'}
            onClick={() => updateSettings({ theoryAnswer: value })}
          >
            {t(`course.answer.${value}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
