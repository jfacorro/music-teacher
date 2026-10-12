import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPracticeTime,
  formatRelativeDays,
} from './format';

// Intl output can use (narrow) no-break spaces; NFKC turns them into plain spaces.
const plain = (s: string) => s.normalize('NFKC');

describe('format', () => {
  it('formats numbers and percentages per language', () => {
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(plain(formatNumber(12345.5, 'es'))).toBe('12.345,5');
    expect(formatPercent(0.95, 'en')).toBe('95%');
    expect(plain(formatPercent(0.95, 'es'))).toBe('95 %');
  });

  it('formats practice time', () => {
    expect(formatPracticeTime(5, 'en')).toBe('5 minutes');
    expect(formatPracticeTime(60, 'en')).toBe('1 hour');
    expect(formatPracticeTime(65, 'en')).toBe('1 hour, 5 minutes');
    expect(formatPracticeTime(1, 'es')).toBe('1 minuto');
    expect(formatPracticeTime(125, 'es')).toBe('2 horas y 5 minutos');
  });

  it('formats dates and relative days', () => {
    const date = new Date(2026, 9, 12);
    expect(formatDate(date, 'en')).toBe('Oct 12, 2026');
    expect(formatDate(date, 'es')).toBe('12 oct 2026');
    expect(formatRelativeDays(-1, 'en')).toBe('yesterday');
    expect(formatRelativeDays(-1, 'es')).toBe('ayer');
  });
});
