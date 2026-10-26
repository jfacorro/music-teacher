import { IconCheck, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface QuizTallyProps {
  /** Each question answered so far: right the first time (true), or not. */
  marks: readonly boolean[];
  total: number;
  /** The question being asked (from 0); null on the results, which show the boxes only. */
  current: number | null;
}

/**
 * How a quiz is going: a box per question, a check for each answered right the first time and a
 * cross for the others, the current one outlined; while asking, "Question 5 of 10 · 3 right ·
 * 1 wrong" over them.
 */
export function QuizTally({ marks, total, current }: QuizTallyProps) {
  const { t } = useTranslation('screens');
  const right = marks.filter(Boolean).length;
  const wrong = marks.length - right;
  return (
    <div className="tally">
      {current !== null && (
        <p className="muted quiz__progress">
          {t('earTraining.progress', { current: current + 1, total })}
          {marks.length > 0 && (
            <>
              {' · '}
              <span className="tally__right">{t('earTraining.tally.right', { count: right })}</span>
              {' · '}
              <span className="tally__wrong">{t('earTraining.tally.wrong', { count: wrong })}</span>
            </>
          )}
        </p>
      )}
      <ol className="tally__boxes" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const mark = marks[i];
          return (
            <li
              key={i}
              className={
                mark === true
                  ? 'tally__box tally__box--right'
                  : mark === false
                    ? 'tally__box tally__box--wrong'
                    : i === current
                      ? 'tally__box tally__box--current'
                      : 'tally__box'
              }
            >
              {mark === true && <IconCheck size={14} stroke={2.5} />}
              {mark === false && <IconX size={14} stroke={2.5} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
