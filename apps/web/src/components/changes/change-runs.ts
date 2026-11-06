import type { ChangeEventItem } from "@asobeast/shared";

export type ChangeEntry =
  | { kind: "event"; event: ChangeEventItem }
  | { kind: "versions"; events: ChangeEventItem[] };

const versionKey = (event: ChangeEventItem): string | null =>
  event.field === "version" ? `${event.appId}:${event.country ?? ""}` : null;

export function collapseVersions(events: ChangeEventItem[]): ChangeEntry[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = versionKey(event);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const runs = new Map<string, ChangeEventItem[]>();
  const entries: ChangeEntry[] = [];
  for (const event of events) {
    const key = versionKey(event);
    if (key === null || (counts.get(key) ?? 0) < 2) {
      entries.push({ kind: "event", event });
      continue;
    }
    const run = runs.get(key);
    if (run) {
      run.push(event);
      continue;
    }
    const started = [event];
    runs.set(key, started);
    entries.push({ kind: "versions", events: started });
  }
  return entries;
}

export const entryEvent = (entry: ChangeEntry): ChangeEventItem =>
  entry.kind === "event" ? entry.event : entry.events[0];
