import { useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { BuildStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { singCards, type SungNote, sungNotes } from '../../../../engine/theoryQuestions';
import type { VocalRange } from '../../../../engine/vocalRange';
import { useNoteNames } from '../../../../i18n/useNoteNames';
import { sings, useSettings } from '../../../../storage/settings';
import { ShortcutButton } from '../../../components/ShortcutButton';
import { useMicWhileShown } from '../../../hooks';
import { BuildQuiz } from '../../../quiz/BuildQuiz';
import { useCardWords } from '../../../quiz/intervalQuiz';
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
  const words = useCardWords(step.questions);
  useMicWhileShown();
  const notes = useRef<SungNote[]>([]);
  const pick = useCallback(
    (range: VocalRange) => {
      notes.current = sungNotes(singCards(step.questions, step.count, range));
      return notes.current.map(({ note }) => note.midi);
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
        const { card, place, given } = notes.current[index]!;
        return {
          play: given.midi,
          prompt: words.sing(card, place),
          again: t('lesson.build.hearRoot', { note: names.name(given, { octave: false }) }),
        };
      }}
      onFinish={({ stars, accuracy }) => onFinish({ stars, accuracy })}
      actions={(summary) => actions(summary.stars)}
    />
  );
}

/** Theory's "find these notes", by playing or by singing, as the learner chose. */
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
