import type { ReactNode } from "react";
import { formatDayMonth } from "@/lib/format";
import { dayBefore } from "@/lib/utc-day";

export const FEED_ROW =
  "grid min-h-10 sm:min-h-9 grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-1.5 text-dense";

export const FEED_LINK =
  "outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring";

export const FEED_TEXT = "line-clamp-2 min-w-0 @2xl/dashboard:line-clamp-1";

export function feedDayLabel(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === dayBefore(today, 1)) return "Yesterday";
  return formatDayMonth(day);
}

export function FeedDay({ children }: { children: ReactNode }) {
  return <span className="text-label text-faint-foreground">{children}</span>;
}
