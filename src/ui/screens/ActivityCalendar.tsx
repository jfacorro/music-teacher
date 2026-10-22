import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../i18n/format';
import { activityLevel, calendarWeeks } from '../../storage/progress';

const WEEKS = 53;
const CELL = 11;
const STEP = CELL + 3;
/** Room for the weekday names on the left and the month names on top. */
const LEFT = 32;
const TOP = 16;
/** Weekdays named on the left (Monday, Wednesday, Friday), as in Date.getDay(). */
const NAMED_WEEKDAYS = [1, 3, 5];
/** A month name needs this many weeks of room before the next one. */
const MONTH_MIN_WEEKS = 3;
const WIDTH = LEFT + WEEKS * STEP;
const HEIGHT = TOP + 7 * STEP;
const LEVELS = [0, 1, 2, 3, 4] as const;
const DAY_TITLE: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };

/** The language's first day of the week (0 = Sunday … 6 = Saturday); Monday if unknown. */
function firstDayOfWeek(language: string): number {
  try {
    const locale = new Intl.Locale(language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info) return info.firstDay % 7;
  } catch {
    // An unknown language: fall back below.
  }
  return 1;
}

/**
 * Practice over the last year, a square per day (the activity graph GitHub made popular):
 * weeks are columns, weekdays rows, and darker greens mean more practice.
 */
export function ActivityCalendar({
  days,
  time,
  streak,
  best,
}: {
  days: Readonly<Record<string, number>>;
  /** Formats a practice time, e.g. "12 minutes". */
  time: (ms: number) => string;
  /** Days in a row practiced up to today, and the most ever. */
  streak: number;
  best: number;
}) {
  const { t, i18n } = useTranslation('screens');
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstDay = firstDayOfWeek(i18n.language);
  const weeks = calendarWeeks(days, WEEKS, firstDay);

  // On narrow screens, start scrolled to the most recent weeks.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, []);

  const month = new Intl.DateTimeFormat(i18n.language, { month: 'short' });
  const weekday = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });

  // A month's name goes over the first week that starts in it, if there's room.
  const starts = weeks.flatMap((week, index) => {
    const first = week[0];
    const previous = weeks[index - 1]?.[0];
    return first && (!previous || first.date.getMonth() !== previous.date.getMonth())
      ? [{ index, date: first.date }]
      : [];
  });
  const months = starts.filter(
    (start, i) => (starts[i + 1]?.index ?? WEEKS) - start.index >= MONTH_MIN_WEEKS,
  );

  const shown = weeks.flat().filter((day) => day !== null);
  const total = shown.reduce((sum, day) => sum + day.ms, 0);
  const practiced = shown.filter((day) => day.ms > 0).length;

  return (
    <section className="card activity" id="activity">
      <h2>{t('progress.activity.heading')}</h2>
      <p className="muted activity__summary">
        <span>
          {practiced > 0
            ? t('progress.activity.total', { time: time(total), count: practiced })
            : t('progress.activity.empty')}
        </span>
        {streak > 0 && (
          <span>
            {best > streak
              ? t('progress.activity.streakBest', { count: streak, best })
              : t('progress.activity.streak', { count: streak })}
          </span>
        )}
      </p>
      <div ref={scrollerRef} className="activity__scroller">
        <svg
          className="activity__chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          // Grows to fill the card; narrower screens scroll instead of shrinking the squares.
          style={{ minInlineSize: WIDTH }}
          role="img"
          aria-label={t('progress.activity.label')}
        >
          {months.map(({ index, date }) => (
            <text key={index} className="activity__label" x={LEFT + index * STEP} y={TOP - 5}>
              {month.format(date)}
            </text>
          ))}
          {Array.from({ length: 7 }, (_, row) => {
            const day = weeks[0]?.[row] ?? weeks[1]?.[row];
            if (!day || !NAMED_WEEKDAYS.includes(day.date.getDay())) return null;
            return (
              <text key={row} className="activity__label" x={0} y={TOP + row * STEP + CELL - 1}>
                {weekday.format(day.date)}
              </text>
            );
          })}
          {weeks.map((week, column) =>
            week.map((day, row) => {
              if (!day) return null;
              const date = formatDate(day.date, i18n.language, DAY_TITLE);
              const label =
                day.ms > 0
                  ? t('progress.activity.day', { date, time: time(day.ms) })
                  : t('progress.activity.none', { date });
              return (
                <rect
                  key={day.day}
                  className={`activity__cell activity__cell--${activityLevel(day.ms)}`}
                  x={LEFT + column * STEP}
                  y={TOP + row * STEP}
                  width={CELL}
                  height={CELL}
                  rx={2}
                >
                  <title>{label}</title>
                </rect>
              );
            }),
          )}
        </svg>
      </div>
      <div className="activity__legend muted" aria-hidden="true">
        {t('progress.activity.less')}
        {LEVELS.map((level) => (
          <span key={level} className={`activity__swatch activity__cell--${level}`} />
        ))}
        {t('progress.activity.more')}
      </div>
    </section>
  );
}
