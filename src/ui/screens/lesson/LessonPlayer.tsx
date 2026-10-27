import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Course, COURSE_UNITS, findLesson } from '../../../content/courses';
import { lessonNamespace, type Lesson } from '../../../content/lessons';
import {
  bestResults,
  earlierDone,
  earlierSteps,
  lessonResult,
  resumeAt,
  type StepResult,
} from '../../../content/lessons/result';
import { useContentText } from '../../../i18n/useContentText';
import { recordResult, resultKey, ResultKind, useProgress } from '../../../storage/progress';
import { recordStepRun, stepKey, useStepRuns } from '../../../storage/stepRuns';
import { useTopBarDetail } from '../../topBar';
import { RunHistory } from '../../components/RunHistory';
import { LessonComplete } from './LessonComplete';
import { ExerciseStepView } from './steps/ExerciseStepView';
import { ExplainStepView } from './steps/ExplainStepView';
import { MatchStepView } from './steps/MatchStepView';
import { FindStepView } from './steps/FindStepView';
import { QuizStepView } from './steps/QuizStepView';
import { RhythmStepView } from './steps/RhythmStepView';
import { SingStepView } from './steps/SingStepView';
import { WarmUpStepView } from './steps/WarmUpStepView';
import { isGraded, StepType } from '../../../content/lessons/lesson';
import { ShortcutButton } from '../../components/ShortcutButton';
import { ShortcutKey } from '../../shortcuts';

/**
 * Steps through a lesson: explanations, key finding, graded exercises, quizzes and rhythms, and
 * for the voice, warm-ups, matching notes and singing melodies.
 */
export function LessonPlayer({ lesson }: { lesson: Lesson }) {
  const { t } = useTranslation('screens');
  const courseText = useContentText('courses');
  const stepText = useContentText(lessonNamespace(lesson.id));
  const { course, unit, lesson: courseLesson } = findLesson(lesson.id)!;

  /** Results per graded step (by index): best run for exercises, full marks for find steps. */
  const [results, setResults] = useState<ReadonlyMap<number, StepResult>>(new Map());
  /** Steps whose goal was reached (found all keys, passed the exercise). */
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());
  const [startedAt, setStartedAt] = useState(() => performance.now());

  // Steps done on earlier visits count too, so one can be skipped without losing its stars.
  const tries = useStepRuns((s) => s.byKey);
  const saved = useProgress((s) => s.results[resultKey(ResultKind.Lesson, lesson.id)]);
  const earlier = useMemo(
    () =>
      earlierSteps(
        lesson.steps,
        (i) => tries[stepKey(lesson.id, i)] ?? [],
        saved && saved.bestStars >= 1
          ? { stars: saved.bestStars, accuracy: saved.bestAccuracy }
          : null,
      ),
    [lesson, tries, saved],
  );
  const doneBefore = useMemo(
    () => earlierDone(lesson.steps, earlier, saved !== undefined),
    [lesson.steps, earlier, saved],
  );

  // A lesson started before opens at its first step not done. One that opens with a warm-up
  // (the voice) warms up first, and continuing from there jumps to that step.
  const [resume] = useState(() => resumeAt(lesson.steps, doneBefore));
  const warmUpFirst = lesson.steps[0]?.type === StepType.WarmUp;
  const [index, setIndex] = useState(warmUpFirst ? 0 : resume);
  const jumpFromWarmUp = useRef(warmUpFirst && resume > 1 ? resume : null);
  const history = useStepRuns((s) => s.byKey[stepKey(lesson.id, index)]);

  const finished = index >= lesson.steps.length;
  const step = lesson.steps[index];
  const text = step ? stepText(`steps.${step.text}`, step.textVars) : '';
  const allResults = useMemo(
    () => bestResults(results, new Map([...earlier].map(([i, step]) => [i, step.result]))),
    [results, earlier],
  );
  const passed = useMemo(() => new Set([...done, ...doneBefore]), [done, doneBefore]);
  const result = lessonResult(lesson.steps, allResults);

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
    jumpFromWarmUp.current = null;
    setIndex(0);
  };
  /** A finished try of a graded step: kept in its history, and the best counts for the lesson. */
  const tried = (stepIndex: number, stepResult: StepResult, passed: boolean) => {
    void recordStepRun(stepKey(lesson.id, stepIndex), { ...stepResult, passed });
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
  const next = () => {
    // Moving on from an explanation or warm-up counts as reading it.
    if (step && !isGraded(step)) markDone(index);
    const jump = jumpFromWarmUp.current;
    jumpFromWarmUp.current = null;
    setIndex(index === 0 && jump !== null ? jump : index + 1);
  };
  const canContinue = (step !== undefined && !isGraded(step)) || passed.has(index);
  const title = courseText(`lessons.${lesson.id}`, courseLesson.titleVars);
  useTopBarDetail(
    t('lesson.topBar', { number: COURSE_UNITS[course].indexOf(unit) + 1, lesson: title }),
  );

  return (
    <section className="screen lesson">
      <header className="lesson__header">
        <p className="muted">{courseText(`units.${unit.id}.title`, unit.textVars)}</p>
        <h1>{title}</h1>
        <ol className="lesson__progress" aria-label={t('lesson.progress')}>
          {lesson.steps.map((_, i) => (
            <li
              key={i}
              className={i === index ? 'is-current' : i < index || passed.has(i) ? 'is-done' : ''}
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
            step?.type === StepType.Rhythm ||
            step?.type === StepType.Match ||
            step?.type === StepType.Sing) && (
            <RunHistory runs={history} label={t('lesson.history.label')} />
          )}
          {step?.type === StepType.Explain && (
            <ExplainStepView
              key={index}
              step={step}
              text={text}
              // Singing is explained without a keyboard, unless it points at keys.
              keyboard={course === Course.Piano || step.keys.length > 0}
            />
          )}
          {step?.type === StepType.Find && (
            <FindStepView
              key={index}
              step={step}
              text={text}
              onDone={() => tried(index, { stars: 3, accuracy: 1 }, true)}
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
          {step?.type === StepType.WarmUp && <WarmUpStepView key={index} step={step} text={text} />}
          {step?.type === StepType.Match && (
            <MatchStepView
              key={index}
              step={step}
              text={text}
              onResult={(stepResult, passed) => tried(index, stepResult, passed)}
              onContinue={next}
            />
          )}
          {step?.type === StepType.Sing && (
            <SingStepView
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
            <ShortcutButton
              shortcut={ShortcutKey.Backspace}
              className="button"
              disabled={index === 0}
              title={t('lesson.tips.back')}
              onClick={() => {
                jumpFromWarmUp.current = null;
                setIndex((i) => i - 1);
              }}
            >
              {t('lesson.back')}
            </ShortcutButton>
            {canContinue ? (
              <ShortcutButton
                shortcut={ShortcutKey.Enter}
                className="button button--primary"
                title={t('lesson.tips.continue')}
                onClick={next}
              >
                {t('lesson.continue')}
              </ShortcutButton>
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
