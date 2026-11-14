import type { ChangeEventItem } from "@asobeast/shared";
import { dayOf } from "./change-fields";
import { collapseVersions, entryEvent, type ChangeEntry } from "./change-runs";

export interface TimelineDay {
  day: string;
  entries: ChangeEntry[];
}

const entryEvents = (entry: ChangeEntry): ChangeEventItem[] =>
  entry.kind === "versions" ? entry.events : [entry.event];

function competitorRunsOnly(entries: ChangeEntry[]): ChangeEntry[] {
  return entries.flatMap((entry): ChangeEntry[] =>
    entry.kind === "versions" && !entry.events[0].isCompetitor
      ? entry.events.map((event) => ({ kind: "event", event }))
      : [entry],
  );
}

export function timelineDays(events: ChangeEventItem[]): TimelineDay[] {
  const groups = new Map<string, ChangeEntry[]>();
  for (const entry of competitorRunsOnly(collapseVersions(events))) {
    const day = dayOf(entryEvent(entry));
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return [...groups.entries()]
    .map(([day, entries]) => ({ day, entries }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

export const changesShownOn = ({ entries }: TimelineDay): number =>
  entries.flatMap(entryEvents).length;

export interface ShownChange {
  appId: string;
  day: string;
}

export function dayShowing(
  groups: readonly TimelineDay[],
  { appId, day }: ShownChange,
): string | null {
  const holder = groups.find(({ entries }) =>
    entries
      .flatMap(entryEvents)
      .some((event) => event.appId === appId && dayOf(event) === day),
  );
  return holder?.day ?? null;
}
