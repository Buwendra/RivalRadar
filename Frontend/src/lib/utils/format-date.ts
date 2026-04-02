import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatSmartDate(dateString: string): string {
  const date = new Date(dateString);
  if (isToday(date)) return `Today at ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `Yesterday at ${format(date, "h:mm a")}`;
  return format(date, "MMM d, yyyy");
}

export function formatFullDate(dateString: string): string {
  return format(new Date(dateString), "MMMM d, yyyy 'at' h:mm a");
}
