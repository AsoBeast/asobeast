import { History } from "lucide-react";
import { formatDate, formatDayMonth } from "@/lib/format";

export const staleCheckLine = (day: string) =>
  `Last checked ${formatDate(day)}; the checks since then did not finish, so this is the position of that day`;

export function StaleCheck({ day }: { day: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-warning">
      <History aria-hidden className="size-3" />
      <span className="sr-only">Last checked </span>
      {formatDayMonth(day)}
    </span>
  );
}
