import { formatDate, formatDayMonth } from "@/lib/format";

export const staleCheckLine = (day: string) =>
  `Last checked ${formatDate(day)}; the checks since then did not finish, so this is the position of that day`;

export const staleCheckLabel = (day: string) =>
  `last checked ${formatDayMonth(day)}`;
