import { useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BuildStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { type IntervalCard, singCards } from '../../../../engine/theoryQuestions';
import type { VocalRange } from '../../../../engine/vocalRange';
import { useNoteNames } from '../../../../i18n/useNoteNames';
import { sings, useSettings } from '../../../../storage/settings';
import { ShortcutButton } from '../../../components/ShortcutButton';
import { useMicWhileShown } from '../../../hooks';
import { BuildQuiz } from '../../../quiz/BuildQuiz';
import { useAnswerNames } from '../../../quiz/intervalQuiz';
import { ShortcutKey } from '../../../shortcuts';
import { MatchTheNote } from '../../MatchTheNote';

interface BuildStepViewProps {
  step: BuildStep;
  text: string;
  onResult: (result: StepResult, passed: boolean) => void;
  onContinue: () => void;
}

/** The notes to work out, sung: the app plays the note given, and listens for the answer. */
function SingTheNotes({
  step,
  onFinish,
  actions,
}: {
  step: BuildStep;
  onFinish: (result: StepResult) => void;
  actions: (stars: number) => ReactNode;
}) {
  const { t } = useTranslation('screens');
  const names = useNoteNames();
  const answers = useAnswerNames();
  useMicWhileShown();
  const cards = useRef<IntervalCard[]>([]);
  const pick = useCallback(
    (range: VocalRange) => {
      cards.current = singCards(step.questions, step.count, range);
      return cards.current.map((card) => card.top.midi);
    },
    [step],
  );

  return (
    <MatchTheNote
      pick={pick}
      tuner
      title={t('lesson.build.singTitle')}
      intro={t('lesson.build.singIntro')}
      clue={(index) => {
        const card = cards.current[index]!;
        const note = names.name(card.root, { octave: false });
        return {
          play: card.root.midi,
          prompt: t('lesson.build.singPrompt', { what: answers.phrase(card.answer), note }),
          again: t('lesson.build.hearRoot', { note }),
        };
      }}
      onFinish={({ stars, accuracy }) => onFinish({ stars, accuracy })}
      actions={(summary) => actions(summary.stars)}
    />
  );
}

/** Theory's "find this note", by playing or by singing, as the learner chose. */
export function BuildStepView({ step, text, onResult, onContinue }: BuildStepViewProps) {
  const { t } = useTranslation('screens');
  const singing = useSettings(sings);
  const passes = (stars: number) => stars >= step.pass.minStars;
  const finish = ({ stars, accuracy }: StepResult) => onResult({ stars, accuracy }, passes(stars));
  const actions = (stars: number) =>
    passes(stars) ? (
      <ShortcutButton
        shortcut={ShortcutKey.Enter}
        className="button button--primary"
        title={t('lesson.tips.continue')}
        onClick={onContinue}
      >
        {t('lesson.continue')}
      </ShortcutButton>
    ) : null;

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <p className="muted">{t('lesson.passRule', { stars: step.pass.minStars })}</p>
      {singing ? (
        <SingTheNotes step={step} onFinish={finish} actions={actions} />
      ) : (
        <BuildQuiz
          questions={step.questions}
          count={step.count}
          onFinish={finish}
          actions={(result) => actions(result.stars)}
        />
      )}
    </div>
  );
}
