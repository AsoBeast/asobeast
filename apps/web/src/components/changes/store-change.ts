import type {
  AppEventRef,
  AppEventsDetail,
  ChangeEventItem,
  EditorsChoiceDetail,
  FeaturingDetail,
  StoryRef,
} from "@asobeast/shared";
import { isoDateOrNull } from "@asobeast/shared";
import { formatDayMonth, pluralize } from "@/lib/format";

export { isStoreField } from "@asobeast/shared";

export const EVENT_FALLBACK_TITLE = "In-app event";

export const STORY_FALLBACK_TITLE = "Featured story";

export const eventTitle = (ref: AppEventRef): string =>
  ref.title ?? ref.kind ?? EVENT_FALLBACK_TITLE;

export const storyTitle = (ref: StoryRef): string =>
  ref.title ?? ref.heading ?? STORY_FALLBACK_TITLE;

function eventRange(ref: AppEventRef): string | null {
  const startsAt = isoDateOrNull(ref.startsAt);
  const endsAt = isoDateOrNull(ref.endsAt);
  if (startsAt !== null && endsAt !== null) {
    return `${formatDayMonth(startsAt)} to ${formatDayMonth(endsAt)}`;
  }
  if (startsAt !== null) return `From ${formatDayMonth(startsAt)}`;
  if (endsAt !== null) return `Until ${formatDayMonth(endsAt)}`;
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

const storyName = (ref: StoryRef): string | null => ref.title ?? ref.heading;

function summaryLine<T>(
  items: readonly T[],
  noun: string,
  verb: string,
  nameOf: (item: T) => string | null,
): string | null {
  const [one] = items;
  if (one && items.length === 1) return named(`${noun} ${verb}`, nameOf(one));
  return items.length > 1
    ? `${pluralize(items.length, noun.toLowerCase())} ${verb}`
    : null;
}

const joined = (lines: Array<string | null>): string =>
  lines.filter((line) => line !== null).join(", ");

function eventsSummary(detail: AppEventsDetail): string {
  return joined([
    summaryLine(detail.added, "Event", "added", (ref) => ref.title ?? ref.kind),
    summaryLine(
      detail.removed,
      "Event",
      "removed",
      (ref) => ref.title ?? ref.kind,
    ),
  ]);
}

function featuringSummary(detail: FeaturingDetail): string {
  return joined([
    summaryLine(detail.added, "Featured story", "added", storyName),
    summaryLine(detail.removed, "Featured story", "removed", storyName),
  ]);
}

function editorsChoiceSummary(detail: EditorsChoiceDetail): string {
  return detail.showsBadge
    ? "Editors' Choice badge added"
    : "Editors' Choice badge removed";
}

export function storeChangeSummary(
  event: Pick<ChangeEventItem, "field" | "detail">,
): string {
  const detail = event.detail;
  if (detail?.kind === "events") return eventsSummary(detail);
  if (detail?.kind === "featuring") return featuringSummary(detail);
  if (detail?.kind === "editorsChoice") return editorsChoiceSummary(detail);
  return "";
}
