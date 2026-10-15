import { useTranslation } from 'react-i18next';
import { type SessionState, FeedbackKind } from '../../../engine/session';
import { useNoteNames } from '../../../i18n/useNoteNames';
import { Timing, Grade } from '../../../engine/timing';

const BadgeTone = {
  Good: 'good',
  Okay: 'okay',
  Bad: 'bad',
} as const;
type BadgeTone = (typeof BadgeTone)[keyof typeof BadgeTone];

interface FeedbackBadgeProps {
  feedback: SessionState['feedback'];
  streak: number;
}

/** The latest verdict ("Perfect!", "Good · early", "Wrong key") and the current streak. */
export function FeedbackBadge({ feedback, streak }: FeedbackBadgeProps) {
  const { t } = useTranslation('feedback');
  const names = useNoteNames();
  if (!feedback) return null;
  const { value } = feedback;

  let text: string;
  let tone: BadgeTone;
  switch (value.kind) {
    case FeedbackKind.Hit:
      text =
        value.timing === Timing.OnTime
          ? t(value.grade)
          : t('withTiming', { grade: t(value.grade), timing: t(value.timing) });
      tone = value.grade === Grade.Ok ? BadgeTone.Okay : BadgeTone.Good;
      break;
    case FeedbackKind.Correct:
      text = t('correct');
      tone = BadgeTone.Good;
      break;
    case FeedbackKind.Wrong:
      text =
        value.expected.length > 0
          ? t('wrongPlay', {
              notes: value.expected.map((p) => names.name(p, { octave: false })).join(', '),
            })
          : t('wrong');
      tone = BadgeTone.Bad;
      break;
    case FeedbackKind.Extra:
      text = t('extra');
      tone = BadgeTone.Bad;
      break;
    case FeedbackKind.Missed:
      text = t('missed');
      tone = BadgeTone.Bad;
      break;
  }

  return (
    <div className="feedback" aria-live="polite">
      {/* Keyed by id so the pop animation replays for every new verdict. */}
      <span key={feedback.id} className={`feedback__badge feedback__badge--${tone}`}>
        {text}
      </span>
      {streak >= 2 && <span className="feedback__streak">{t('streak', { count: streak })}</span>}
    </div>
  );
}
