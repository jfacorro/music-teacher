import { useTranslation } from 'react-i18next';
import type { SessionState } from '../../../engine/session';
import { useNoteNames } from '../../../i18n/useNoteNames';

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
  let tone: 'good' | 'okay' | 'bad';
  switch (value.kind) {
    case 'hit':
      text =
        value.timing === 'onTime'
          ? t(value.grade)
          : t('withTiming', { grade: t(value.grade), timing: t(value.timing) });
      tone = value.grade === 'ok' ? 'okay' : 'good';
      break;
    case 'correct':
      text = t('correct');
      tone = 'good';
      break;
    case 'wrong':
      text =
        value.expected.length > 0
          ? t('wrongPlay', {
              notes: value.expected.map((p) => names.name(p, { octave: false })).join(', '),
            })
          : t('wrong');
      tone = 'bad';
      break;
    case 'missed':
      text = t('missed');
      tone = 'bad';
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
