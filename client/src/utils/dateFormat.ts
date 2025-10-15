import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

dayjs.extend(relativeTime);
dayjs.extend(utc);

/**
 * Formats a date/time string consistently across the application
 * @param date - ISO string, Date object, or timestamp
 * @param format - Format type: 'full', 'short', 'time', 'relative'
 * @returns Formatted date string
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  format: 'full' | 'short' | 'time' | 'relative' = 'full'
): string {
  if (!date) return 'Never';

  // If the date string doesn't have timezone info (like SQLite datetime),
  // treat it as UTC and convert to local time
  let d;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(date) && !date.includes('Z') && !date.includes('+')) {
    // SQLite datetime format without timezone - treat as UTC
    d = dayjs.utc(date).local();
  } else {
    d = dayjs(date);
  }

  if (!d.isValid()) return 'Invalid Date';

  switch (format) {
    case 'full':
      // e.g., "Oct 15, 2025 10:30:45"
      return d.format('MMM DD, YYYY HH:mm:ss');
    case 'short':
      // e.g., "Oct 15 10:30"
      return d.format('MMM DD HH:mm');
    case 'time':
      // e.g., "10:30:45"
      return d.format('HH:mm:ss');
    case 'relative':
      // e.g., "2 minutes ago"
      return d.fromNow();
    default:
      return d.format('MMM DD, YYYY HH:mm:ss');
  }
}

/**
 * Formats a date for display in tables (consistent short format)
 */
export function formatTableDate(date: string | Date | number | null | undefined): string {
  return formatDateTime(date, 'short');
}

/**
 * Formats a date for detailed views (consistent full format)
 */
export function formatDetailDate(date: string | Date | number | null | undefined): string {
  return formatDateTime(date, 'full');
}
