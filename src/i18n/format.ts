/** Locale-aware formatting via the built-in Intl APIs (PLAN.md §8.1). */

export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language).format(value);
}

/** `ratio` is 0–1: 0.95 → "95%" (en) / "95 %" (es). */
export function formatPercent(ratio: number, language: string, maxFractionDigits = 0): string {
  return new Intl.NumberFormat(language, {
    style: 'percent',
    maximumFractionDigits: maxFractionDigits,
  }).format(ratio);
}

/** Practice time: "1 hour, 5 minutes" / "1 hora y 5 minutos". */
export function formatPracticeTime(totalMinutes: number, language: string): string {
  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const unit = (value: number, name: 'hour' | 'minute') =>
    new Intl.NumberFormat(language, { style: 'unit', unit: name, unitDisplay: 'long' }).format(
      value,
    );
  if (hours === 0) return unit(rest, 'minute');
  if (rest === 0) return unit(hours, 'hour');
  return new Intl.ListFormat(language, { type: 'unit', style: 'long' }).format([
    unit(hours, 'hour'),
    unit(rest, 'minute'),
  ]);
}

export function formatDate(
  date: Date,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(language, options).format(date);
}

/** Relative days: -1 → "yesterday" / "ayer". */
export function formatRelativeDays(days: number, language: string): string {
  return new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(days, 'day');
}
