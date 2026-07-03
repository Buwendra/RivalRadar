import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

/**
 * date-fns `format()` THROWS a RangeError on an invalid Date, which turns one
 * malformed stored timestamp (e.g. a citation publishedAt the model produced)
 * into a white-screened card. Every formatter below degrades to an em-dash
 * instead of crashing the tree.
 */
const INVALID_DATE_FALLBACK = "—";

function parseDate(dateString: string): Date | null {
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatRelativeDate(dateString: string): string {
  const date = parseDate(dateString);
  if (!date) return INVALID_DATE_FALLBACK;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatSmartDate(dateString: string): string {
  const date = parseDate(dateString);
  if (!date) return INVALID_DATE_FALLBACK;
  if (isToday(date)) return `Today at ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `Yesterday at ${format(date, "h:mm a")}`;
  return format(date, "MMM d, yyyy");
}

export function formatFullDate(dateString: string): string {
  const date = parseDate(dateString);
  if (!date) return INVALID_DATE_FALLBACK;
  return format(date, "MMMM d, yyyy 'at' h:mm a");
}
