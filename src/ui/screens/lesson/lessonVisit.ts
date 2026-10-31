import { useLocation } from 'react-router';

/** What comes with the address when a lesson is opened from another one (PLAN.md milestone 7.2). */
export interface LessonVisit {
  /** The lesson to go back to at the end, in another course. */
  backTo?: string;
  /** Come back to a finished lesson: open it on its finished screen. */
  finished?: boolean;
}

export const useLessonVisit = () => (useLocation().state ?? {}) as LessonVisit;
