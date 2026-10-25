/** Locale-aware formatting via the built-in Intl APIs (PLAN.md §8.1). */

/**
 * Intl formatters are slow to make (a fraction of a millisecond each) and quick to use, and some
 * screens format hundreds of values (Home's year of practice): each is made once, per kind,
 * language and options, and kept.
 */
const formatters = new Map<string, unknown>();

function cached<T>(kind: string, language: string, options: object, make: () => T): T {
  const key = `${kind}|${language}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key) as T | undefined;
  if (formatter === undefined) {
    formatter = make();
    formatters.set(key, formatter);
  }
  return formatter;
}

const numberFormat = (language: string, options: Intl.NumberFormatOptions = {}) =>
  cached('number', language, options, () => new Intl.NumberFormat(language, options));

export function formatNumber(value: number, language: string): string {
  return numberFormat(language).format(value);
}

/** `ratio` is 0–1: 0.95 → "95%" (en) / "95 %" (es). */
export function formatPercent(ratio: number, language: string, maxFractionDigits = 0): string {
  return numberFormat(language, {
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
    numberFormat(language, { style: 'unit', unit: name, unitDisplay: 'long' }).format(value);
  if (hours === 0) return unit(rest, 'minute');
  if (rest === 0) return unit(hours, 'hour');
  const options: Intl.ListFormatOptions = { type: 'unit', style: 'long' };
  return cached('list', language, options, () => new Intl.ListFormat(language, options)).format([
    unit(hours, 'hour'),
    unit(rest, 'minute'),
  ]);
}

export function formatDate(
  date: Date,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return cached('date', language, options, () => new Intl.DateTimeFormat(language, options)).format(
    date,
  );
}

/** Relative days: -1 → "yesterday" / "ayer". */
export function formatRelativeDays(days: number, language: string): string {
  const options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' };
  return cached(
    'relative',
    language,
    options,
    () => new Intl.RelativeTimeFormat(language, options),
  ).format(days, 'day');
}
