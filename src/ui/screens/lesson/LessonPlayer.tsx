import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findLesson } from '../../../content/courses';
import { lessonNamespace, type Lesson } from '../../../content/lessons';
import { useContentText } from '../../../i18n/useContentText';
import { LessonComplete } from './LessonComplete';
import { ExerciseStepView } from './steps/ExerciseStepView';
import { ExplainStepView } from './steps/ExplainStepView';
import { FindStepView } from './steps/FindStepView';

/** Steps through a lesson: explanations, key finding and graded exercises. */
export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { t } = useTranslation('screens');
  const courseText = useContentText('courses');
  const stepText = useContentText(lessonNamespace(lesson.id));
  const { unit, lesson: courseLesson } = findLesson(lesson.id)!;

  const [index, setIndex] = useState(0);
  /** Stars per graded step (by index): best run for exercises, 3 for completed find steps. */
  const [stars, setStars] = useState<ReadonlyMap<number, number>>(new Map());
  /** Steps whose goal was reached (found all keys, passed the exercise). */
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());

  const finished = index >= lesson.steps.length;
  const step = lesson.steps[index];
  const text = step ? stepText(`steps.${step.text}`, step.textVars) : '';

  const markDone = (stepIndex: number) => setDone((prev) => new Set(prev).add(stepIndex));
  const next = () => setIndex((i) => i + 1);
  const canContinue = step?.type === 'explain' || done.has(index);

  return (
    <section className="screen lesson">
      <header className="lesson__header">
        <p className="muted">{courseText(`units.${unit.id}.title`, unit.textVars)}</p>
        <h1>{courseText(`lessons.${lesson.id}`, courseLesson.titleVars)}</h1>
        <ol className="lesson__progress" aria-label={t('lesson.progress')}>
          {lesson.steps.map((_, i) => (
            <li
              key={i}
              className={i === index ? 'is-current' : i < index || done.has(i) ? 'is-done' : ''}
              aria-current={i === index ? 'step' : undefined}
            >
              <span className="visually-hidden">
                {t('lesson.step', { current: i + 1, total: lesson.steps.length })}
              </span>
            </li>
          ))}
        </ol>
      </header>

      {finished ? (
        <LessonComplete lesson={lesson} stars={stars} onRestart={() => setIndex(0)} />
      ) : (
        <>
          {step?.type === 'explain' && <ExplainStepView key={index} step={step} text={text} />}
          {step?.type === 'find' && (
            <FindStepView
              key={index}
              step={step}
              text={text}
              onDone={() => {
                setStars((prev) => new Map(prev).set(index, 3));
                markDone(index);
              }}
            />
          )}
          {step?.type === 'exercise' && (
            <ExerciseStepView
              key={index}
              step={step}
              text={text}
              onResult={(earned, passed) => {
                setStars((prev) =>
                  new Map(prev).set(index, Math.max(prev.get(index) ?? 0, earned)),
                );
                if (passed) markDone(index);
              }}
              onContinue={next}
            />
          )}

          <nav className="lesson__nav">
            <button
              type="button"
              className="button"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              {t('lesson.back')}
            </button>
            {canContinue ? (
              <button type="button" className="button button--primary" onClick={next}>
                {t('lesson.continue')}
              </button>
            ) : (
              <button type="button" className="button button--quiet" onClick={next}>
                {t('lesson.skip')}
              </button>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
