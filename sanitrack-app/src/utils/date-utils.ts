import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfYear, parseISO, isValid } from 'date-fns';
import type { DateRange } from '../models/types';

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) {
    throw new Error('Invalid date');
  }
  return format(d, 'dd/MM/yyyy');
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) {
    throw new Error('Duration cannot be negative');
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseDuration(h: number, m: number, s: number): number {
  return h * 3600 + m * 60 + s;
}

export function getDateRange(
  period: 'day' | 'week' | 'month' | 'year' | 'custom',
  customStart?: string,
  customEnd?: string,
): DateRange {
  const now = new Date();
  switch (period) {
    case 'day':
      return {
        start: startOfDay(now).toISOString(),
        end: endOfDay(now).toISOString(),
      };
    case 'week':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        end: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      };
    case 'month':
      return {
        start: startOfMonth(now).toISOString(),
        end: endOfMonth(now).toISOString(),
      };
    case 'year':
      return {
        start: startOfYear(now).toISOString(),
        end: endOfYear(now).toISOString(),
      };
    case 'custom': {
      if (!customStart || !customEnd) {
        throw new Error('Custom period requires both customStart and customEnd');
      }
      return {
        start: startOfDay(parseISO(customStart)).toISOString(),
        end: endOfDay(parseISO(customEnd)).toISOString(),
      };
    }
  }
}

export function groupByPeriod<T>(
  items: T[],
  dateKey: keyof T,
  period: 'day' | 'week' | 'month' | 'year',
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const dateValue = item[dateKey];
    if (typeof dateValue !== 'string') continue;

    const date = parseISO(dateValue);
    if (!isValid(date)) continue;

    let key: string;
    switch (period) {
      case 'day':
        key = format(date, 'yyyy-MM-dd');
        break;
      case 'week':
        key = format(date, 'yyyy-ww');
        break;
      case 'month':
        key = format(date, 'yyyy-MM');
        break;
      case 'year':
        key = format(date, 'yyyy');
        break;
    }

    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return groups;
}