import type {
  AppEventRef,
  AppEventsDetail,
  ChangeEventItem,
  ChangeField,
  EditorsChoiceDetail,
  FeaturingDetail,
  StoryRef,
} from "@asobeast/shared";
import { formatDayMonth, pluralize } from "@/lib/format";

const STORE_FIELDS: ReadonlySet<ChangeField> = new Set([
  "inAppEvents",
  "featuring",
  "editorsChoice",
]);

export const isStoreField = (field: ChangeField): boolean =>
  STORE_FIELDS.has(field);

export const EVENT_FALLBACK_TITLE = "In-app event";

export const STORY_FALLBACK_TITLE = "Featured story";

export const eventTitle = (ref: AppEventRef): string =>
  ref.title ?? ref.kind ?? EVENT_FALLBACK_TITLE;

export const storyTitle = (ref: StoryRef): string =>
  ref.title ?? ref.heading ?? STORY_FALLBACK_TITLE;

function eventRange(ref: AppEventRef): string | null {
  if (ref.startsAt !== null && ref.endsAt !== null) {
    return `${formatDayMonth(ref.startsAt)} to ${formatDayMonth(ref.endsAt)}`;
  }
  if (ref.startsAt !== null) return `From ${formatDayMonth(ref.startsAt)}`;
  if (ref.endsAt !== null) return `Until ${formatDayMonth(ref.endsAt)}`;
  return null;
}

export function eventMeta(ref: AppEventRef): string | null {
  const parts = [
    ref.title === null ? null : ref.kind,
    ref.badge,
    eventRange(ref),
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

const named = (label: string, name: string | null): string =>
  name === null ? label : `${label}: ${name}`;

const eventLine = (label: string, ref: AppEventRef): string =>
  named(label, ref.title ?? ref.kind);

const storyName = (ref: StoryRef): string | null => ref.title ?? ref.heading;

function eventsSummary(detail: AppEventsDetail): string {
  const parts: string[] = [];
  if (detail.added.length === 1) {
    parts.push(eventLine("Event added", detail.added[0]!));
  } else if (detail.added.length > 1) {
    parts.push(`${pluralize(detail.added.length, "event")} added`);
  }
  if (detail.removed.length === 1) {
    parts.push(eventLine("Event removed", detail.removed[0]!));
  } else if (detail.removed.length > 1) {
    parts.push(`${pluralize(detail.removed.length, "event")} removed`);
  }
  return parts.join(", ");
}

function featuringSummary(detail: FeaturingDetail): string {
  const parts: string[] = [];
  if (detail.added.length === 1) {
    parts.push(named("Featured story added", storyName(detail.added[0]!)));
  } else if (detail.added.length > 1) {
    parts.push(`${pluralize(detail.added.length, "story")} added`);
  }
  if (detail.removed.length === 1) {
    parts.push(named("Featured story removed", storyName(detail.removed[0]!)));
  } else if (detail.removed.length > 1) {
    parts.push(`${pluralize(detail.removed.length, "story")} removed`);
  }
  return parts.join(", ");
}

function editorsChoiceSummary(detail: EditorsChoiceDetail): string {
  return detail.showsBadge
    ? "Editors' Choice badge added"
    : "Editors' Choice badge removed";
}

export function storeChangeSummary(event: ChangeEventItem): string {
  const detail = event.detail;
  if (detail?.kind === "events") return eventsSummary(detail);
  if (detail?.kind === "featuring") return featuringSummary(detail);
  if (detail?.kind === "editorsChoice") return editorsChoiceSummary(detail);
  return "";
}
