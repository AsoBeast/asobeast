import type {
  ChangeEventItem,
  ChangeField,
  VisibilityPoint,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enChanges from "../../../messages/en/changes.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatDayMonthInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";
import { dayBefore } from "@/lib/utc-day";
import {
  attributeFields,
  CHANGE_KINDS,
  changedFieldWords,
  fieldPhrase,
  changeKind,
  dayOf,
  type ChangeKind,
} from "./change-fields";

const english = createTranslator({
  locale: "en",
  namespace: "changes",
  messages: { changes: enChanges },
});

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
  t: MessageTranslator = english,
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
      appName: appEvents[0].appName ?? t("unknownApp"),
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

export function markLabel(
  lane: Lane,
  mark: LaneMark,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const from = formatDayMonthInLocale(mark.from, locale);
  const to = formatDayMonthInLocale(mark.day, locale);
  return t(mark.from === mark.day ? "activity.markDay" : "activity.markRange", {
    day: from,
    from,
    to,
    subject: changeSubject(lane, mark.fields, t, locale),
  });
}

function changeSubject(
  lane: Lane,
  fields: readonly ChangeField[],
  t: MessageTranslator,
  locale: Locale,
): string {
  if (!lane.own) {
    return t("activity.rivalSubject", {
      name: lane.appName,
      fields: fieldPhrase(fields, "the", t, locale),
    });
  }
  const { yours, storeDecided } = attributeFields(fields);
  const parts: string[] = [];
  if (yours.length > 0) {
    parts.push(
      t("activity.youSubject", {
        fields: fieldPhrase(yours, "the", t, locale),
      }),
    );
  }
  if (storeDecided.length > 0) {
    parts.push(
      t("activity.storeSubject", {
        fields: fieldPhrase(storeDecided, "the", t, locale),
      }),
    );
  }
  return parts.join(t("activity.subjectSeparator"));
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

export function changeLinesOn(
  lanes: readonly Lane[],
  day: string,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string[] {
  return lanes.flatMap((lane) => {
    const fields = lane.marks.flatMap((mark) =>
      mark.changes
        .filter((change) => change.day === day)
        .map((change) => change.field),
    );
    return fields.length === 0 ? [] : dayLines(lane, fields, t, locale);
  });
}

function dayLines(
  lane: Lane,
  fields: ChangeField[],
  t: MessageTranslator,
  locale: Locale,
): string[] {
  if (!lane.own) {
    return [
      t("activity.rivalDay", {
        name: lane.appName,
        fields: changedFieldWords(fields, t, locale),
      }),
    ];
  }
  const { yours, storeDecided } = attributeFields(fields);
  const lines: string[] = [];
  if (yours.length > 0) {
    lines.push(
      t("activity.youDay", {
        fields: changedFieldWords(yours, t, locale),
      }),
    );
  }
  if (storeDecided.length > 0) {
    lines.push(
      t("activity.storeDay", {
        fields: changedFieldWords(storeDecided, t, locale),
      }),
    );
  }
  return lines;
}
