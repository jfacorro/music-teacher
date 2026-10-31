import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuizResult } from '../../engine/quiz';
import { formatPercent } from '../../i18n/format';
import { ShortcutButton } from '../components/ShortcutButton';
import { Stars } from '../components/Stars';
import { ShortcutKey } from '../shortcuts';

/** The end of a quiz: stars, accuracy, how many were right the first time, and Try again. */
export function QuizResults({
  result,
  onRetry,
  actions,
}: {
  result: QuizResult;
  onRetry: () => void;
  /** Extra buttons next to Try again (e.g. Continue in a lesson). */
  actions?: (result: QuizResult) => ReactNode;
}) {
  const { t, i18n } = useTranslation('screens');
  return (
    <section className="results quiz__results" aria-labelledby="quiz-results">
      <h2 id="quiz-results">{t('quiz.results')}</h2>
      <Stars stars={result.stars} />
      <p className="results__accuracy">
        <span className="muted">{t('practice.results.accuracy')}</span>
        <strong>{formatPercent(result.accuracy, i18n.language)}</strong>
      </p>
      <p>{t('quiz.firstTry', { count: result.firstTry, total: result.total })}</p>
      <div className="button-row results__actions">
        <ShortcutButton
          shortcut={ShortcutKey.Space}
          className={actions ? 'button' : 'button button--primary'}
          title={t('quiz.newCards')}
          onClick={onRetry}
        >
          {t('practice.results.retry')}
        </ShortcutButton>
        {actions?.(result)}
      </div>
    </section>
  );
}
