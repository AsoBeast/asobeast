import type {
  ChangeEventItem,
  ChangeField,
  VisibilityPoint,
} from "@asobeast/shared";
import { formatDayMonth } from "@/lib/format";
import { dayBefore } from "@/lib/utc-day";
import {
  CHANGE_KINDS,
  changedFieldWords,
  fieldPhrase,
  changeKind,
  dayOf,
  type ChangeKind,
} from "./change-fields";

const DAILY_MARKS_UP_TO_DAYS = 90;
const WEEK = 7;

export function windowDays(today: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    dayBefore(today, days - 1 - index),
  );
}

export function changeWindowRange(
  today: string,
  days: number,
): { from: string; to: string } {
  return { from: dayBefore(today, days - 1), to: today };
}

export interface VisibilityRow {
  date: string;
  visibility: number | null;
}

export function visibilityRows(
  points: readonly VisibilityPoint[],
  days: readonly string[],
): VisibilityRow[] {
  const byDay = new Map(points.map((point) => [point.date, point.visibility]));
  return days.map((date) => ({ date, visibility: byDay.get(date) ?? null }));
}

export interface LaneMark {
  day: string;
  from: string;
  position: number;
  kinds: ChangeKind[];
  fields: ChangeField[];
  changes: Array<{ day: string; field: ChangeField }>;
}

export interface Lane {
  appId: string;
  appName: string;
  iconUrl: string | null;
  own: boolean;
  count: number;
  marks: LaneMark[];
}

function laneMarks(
  events: readonly ChangeEventItem[],
  days: readonly string[],
): LaneMark[] {
  const size = days.length > DAILY_MARKS_UP_TO_DAYS ? WEEK : 1;
  const indexOf = new Map(days.map((day, index) => [day, index]));
  const last = Math.max(days.length - 1, 1);
  const buckets = new Map<number, ChangeEventItem[]>();
  for (const event of events) {
    const index = indexOf.get(dayOf(event));
    if (index === undefined) continue;
    const bucket = Math.floor((days.length - 1 - index) / size);
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), event]);
  }
  return [...buckets.entries()]
    .map(([bucket, bucketEvents]) => {
      const eventDays = bucketEvents.map(dayOf).sort();
      const fields = [...new Set(bucketEvents.map((event) => event.field))];
      const kinds = new Set(fields.map(changeKind));
      const centre = days.length - 1 - bucket * size - (size - 1) / 2;
      return {
        day: eventDays[eventDays.length - 1],
        from: eventDays[0],
        position: Math.max(centre, 0) / last,
        kinds: CHANGE_KINDS.filter((kind) => kinds.has(kind)),
        fields,
        changes: bucketEvents.map((event) => ({
          day: dayOf(event),
          field: event.field,
        })),
      };
    })
    .sort((a, b) => a.position - b.position);
}

export function activityLanes(
  events: readonly ChangeEventItem[],
  days: readonly string[],
): Lane[] {
  const inWindow = new Set(days);
  const byApp = new Map<string, ChangeEventItem[]>();
  for (const event of events) {
    if (!inWindow.has(dayOf(event))) continue;
    byApp.set(event.appId, [...(byApp.get(event.appId) ?? []), event]);
  }
  return [...byApp.entries()]
    .map(([appId, appEvents]) => ({
      appId,
      appName: appEvents[0].appName ?? "Unknown app",
      iconUrl: appEvents.find((event) => event.iconUrl)?.iconUrl ?? null,
      own: !appEvents[0].isCompetitor,
      count: appEvents.length,
      marks: laneMarks(appEvents, days),
    }))
    .sort(
      (a, b) =>
        Number(b.own) - Number(a.own) ||
        b.count - a.count ||
        a.appName.localeCompare(b.appName, "en"),
    );
}

export function markLabel(lane: Lane, mark: LaneMark): string {
  const when =
    mark.from === mark.day
      ? formatDayMonth(mark.day)
      : `${formatDayMonth(mark.from)} to ${formatDayMonth(mark.day)}`;
  const who = lane.own ? "you changed" : `${lane.appName} changed`;
  return `${when}: ${who} ${fieldPhrase(mark.fields, "the")}`;
}

export function ownChangeDays(
  events: readonly ChangeEventItem[],
  days: readonly string[],
): string[] {
  const inWindow = new Set(days);
  return [
    ...new Set(
      events
        .filter((event) => !event.isCompetitor)
        .map(dayOf)
        .filter((day) => inWindow.has(day)),
    ),
  ];
}

export function changeLinesOn(lanes: readonly Lane[], day: string): string[] {
  return lanes.flatMap((lane) => {
    const fields = lane.marks.flatMap((mark) =>
      mark.changes
        .filter((change) => change.day === day)
        .map((change) => change.field),
    );
    return fields.length === 0
      ? []
      : [`${lane.own ? "You" : lane.appName}: ${changedFieldWords(fields)}`];
  });
}
