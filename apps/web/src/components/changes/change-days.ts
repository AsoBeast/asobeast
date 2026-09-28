import type { ChangeEventItem } from "@asobeast/shared";
import { formatDate } from "@/lib/format";

const DAY_MS = 86_400_000;

export interface ChangeDay {
  day: string;
  label: string;
  events: ChangeEventItem[];
}

const previousDay = (day: string): string =>
  new Date(Date.parse(`${day}T00:00:00.000Z`) - DAY_MS)
    .toISOString()
    .slice(0, 10);

export function groupChangesByDay(
  events: ChangeEventItem[],
  today: string,
): ChangeDay[] {
  const labels = new Map([
    [today, "Today"],
    [previousDay(today), "Yesterday"],
  ]);
  const groups = new Map<string, ChangeDay>();
  for (const event of events) {
    const day = event.capturedAt.slice(0, 10);
    const group = groups.get(day);
    if (group) {
      group.events.push(event);
    } else {
      groups.set(day, {
        day,
        label: labels.get(day) ?? formatDate(day),
        events: [event],
      });
    }
  }
  return [...groups.values()];
}
