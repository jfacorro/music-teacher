import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findLesson } from '../../../content/courses';
import { lessonNamespace, type Lesson } from '../../../content/lessons';
import { lessonResult, type StepResult } from '../../../content/lessons/result';
import { useContentText } from '../../../i18n/useContentText';
import { recordResult, ResultKind } from '../../../storage/progress';
import { loadStepRuns, recordStepRun, stepKey, useStepRuns } from '../../../storage/stepRuns';
import { StepHistory } from './StepHistory';
import { LessonComplete } from './LessonComplete';
import { ExerciseStepView } from './steps/ExerciseStepView';
import { ExplainStepView } from './steps/ExplainStepView';
import { FindStepView } from './steps/FindStepView';
import { QuizStepView } from './steps/QuizStepView';
import { RhythmStepView } from './steps/RhythmStepView';
import { StepType } from '../../../content/lessons/lesson';

/** Steps through a lesson: explanations, key finding, graded exercises, quizzes and rhythms. */
export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { t } = useTranslation('screens');
  const courseText = useContentText('courses');
  const stepText = useContentText(lessonNamespace(lesson.id));
  const { unit, lesson: courseLesson } = findLesson(lesson.id)!;

  const [index, setIndex] = useState(0);
  /** Results per graded step (by index): best run for exercises, full marks for find steps. */
  const [results, setResults] = useState<ReadonlyMap<number, StepResult>>(new Map());
  /** Steps whose goal was reached (found all keys, passed the exercise). */
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());
  const [startedAt, setStartedAt] = useState(() => performance.now());

  // Every try of the graded steps, kept to show how each went before.
  useEffect(() => {
    void loadStepRuns(lesson.id);
  }, [lesson.id]);
  const history = useStepRuns((s) => s.byKey[stepKey(lesson.id, index)]);

  const finished = index >= lesson.steps.length;
  const step = lesson.steps[index];
  const text = step ? stepText(`steps.${step.text}`, step.textVars) : '';
  const result = lessonResult(lesson.steps, results);

  // Save the lesson once each time it's completed.
  const recorded = useRef(false);
  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    void recordResult(ResultKind.Lesson, lesson.id, {
      ...result,
      durationMs: performance.now() - startedAt,
    });
  }, [finished, lesson.id, result, startedAt]);

  const restart = () => {
    recorded.current = false;
    setResults(new Map());
    setDone(new Set());
    setStartedAt(performance.now());
    setIndex(0);
  };
  /** A finished try of a graded step: kept in its history, and the best counts for the lesson. */
  const tried = (stepIndex: number, stepResult: StepResult, passed: boolean) => {
    void recordStepRun(stepKey(lesson.id, stepIndex), stepResult);
    saveStep(stepIndex, stepResult);
    if (passed) markDone(stepIndex);
  };
  const saveStep = (stepIndex: number, stepResult: StepResult) =>
    setResults((prev) => {
      const best = prev.get(stepIndex);
      if (best && best.stars >= stepResult.stars && best.accuracy >= stepResult.accuracy) {
        return prev;
      }
      return new Map(prev).set(stepIndex, {
        stars: Math.max(best?.stars ?? 0, stepResult.stars),
        accuracy: Math.max(best?.accuracy ?? 0, stepResult.accuracy),
      });
    });
  const markDone = (stepIndex: number) => setDone((prev) => new Set(prev).add(stepIndex));
  const next = () => setIndex((i) => i + 1);
  const canContinue = step?.type === StepType.Explain || done.has(index);

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
        <LessonComplete lessonId={lesson.id} stars={result.stars} onRestart={restart} />
      ) : (
        <>
          {(step?.type === StepType.Exercise ||
            step?.type === StepType.Quiz ||
            step?.type === StepType.Rhythm) && <StepHistory runs={history} />}
          {step?.type === StepType.Explain && (
            <ExplainStepView key={index} step={step} text={text} />
          )}
          {step?.type === StepType.Find && (
            <FindStepView
              key={index}
              step={step}
              text={text}
              onDone={() => {
                saveStep(index, { stars: 3, accuracy: 1 });
                markDone(index);
              }}
            />
          )}
          {step?.type === StepType.Quiz && (
            <QuizStepView
              key={index}
              step={step}
              text={text}
              onResult={(stepResult, passed) => tried(index, stepResult, passed)}
              onContinue={next}
            />
          )}
          {step?.type === StepType.Rhythm && (
            <RhythmStepView
              key={index}
              step={step}
              text={text}
              onResult={(stepResult, passed) => tried(index, stepResult, passed)}
              onContinue={next}
            />
          )}
          {step?.type === StepType.Exercise && (
            <ExerciseStepView
              key={index}
              step={step}
              text={text}
              onResult={(stepResult, passed) => tried(index, stepResult, passed)}
              onContinue={next}
              recordingKey={`lesson:${lesson.id}:${index}`}
            />
          )}

          <nav className="lesson__nav">
            <button
              type="button"
              className="button"
              disabled={index === 0}
              title={t('lesson.tips.back')}
              onClick={() => setIndex((i) => i - 1)}
            >
              {t('lesson.back')}
            </button>
            {canContinue ? (
              <button
                type="button"
                className="button button--primary"
                title={t('lesson.tips.continue')}
                onClick={next}
              >
                {t('lesson.continue')}
              </button>
            ) : (
              <button
                type="button"
                className="button button--quiet"
                title={t('lesson.tips.skip')}
                onClick={next}
              >
                {t('lesson.skip')}
              </button>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
