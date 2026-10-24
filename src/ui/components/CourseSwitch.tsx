/**
 * The course being practiced, piano or voice, as the first part of the top bar's path
 * ("Piano Teacher / Voice / Learn"): a short list of both, each saying where you are. The
 * sections, Learn, Home and Today follow it (PLAN.md milestone 6.2).
 */
import { IconChevronDown } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { Course, COURSES, COURSE_UNITS, lessonOrder } from '../../content/courses';
import { lessonStates, nextLessonToPlay } from '../../content/unlock';
import { MicStatus, useMic } from '../../input/mic/micInput';
import { enableMic } from '../../preferences';
import { resultKey, ResultKind, useProgress } from '../../storage/progress';
import { updateSettings, useSettings } from '../../storage/settings';
import { COURSE_SECTIONS, SECTION_PATHS, sectionOf } from '../sections';

export function CourseSwitch({ onChoose }: { onChoose?: () => void }) {
  const { t } = useTranslation();
  const course = useSettings((s) => s.course);
  const vocalRange = useSettings((s) => s.vocalRange);
  const results = useProgress((s) => s.results);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // A click outside or Esc closes the list.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Where you are in a course: its unit, or not started yet. */
  const whereIn = (which: Course) => {
    const units = COURSE_UNITS[which];
    const starsOf = (id: string) => results[resultKey(ResultKind.Lesson, id)]?.bestStars ?? 0;
    const started = lessonOrder(which).some((id) => results[resultKey(ResultKind.Lesson, id)]);
    if (!started) {
      return which === Course.Voice && !vocalRange
        ? t('courseSwitch.findRangeFirst')
        : t('courseSwitch.notStarted');
    }
    const next = nextLessonToPlay(units, lessonStates(units, starsOf));
    if (!next) return t('courseSwitch.allDone', { total: units.length });
    const number = units.findIndex((unit) => unit.lessons.some((l) => l.id === next)) + 1;
    return t('courseSwitch.unit', { number, total: units.length });
  };

  const choose = (next: Course) => {
    setOpen(false);
    onChoose?.();
    if (next === course) return;
    updateSettings({ course: next });
    if (next === Course.Voice) {
      const status = useMic.getState().status;
      if (status !== MicStatus.On && status !== MicStatus.Starting) void enableMic();
      // The voice starts with the range test, so exercises fit it.
      if (!vocalRange) {
        void navigate('/settings#voice');
        return;
      }
    }
    // The same section, if the other course has it (back to its page); Home otherwise.
    const section = sectionOf(pathname);
    const target = COURSE_SECTIONS[next].includes(section) ? SECTION_PATHS[section] : '/';
    if (target !== pathname) void navigate(target);
  };

  return (
    <span className="course-switch" ref={root}>
      <button
        type="button"
        className="course-switch__button"
        aria-haspopup="true"
        aria-expanded={open}
        title={t('courseSwitch.tip')}
        onClick={() => setOpen((value) => !value)}
      >
        {t(`courseSwitch.courses.${course}`)}
        <IconChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <ul className="course-switch__list" aria-label={t('courseSwitch.label')}>
          {COURSES.map((which) => (
            <li key={which}>
              <button
                type="button"
                className="course-switch__choice"
                aria-current={which === course ? 'true' : undefined}
                onClick={() => choose(which)}
              >
                <span className="course-switch__name">{t(`courseSwitch.courses.${which}`)}</span>
                <span className="course-switch__where">{whereIn(which)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
