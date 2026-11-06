import type {
  DiscoverySource,
  KeywordDiscoveryCount,
  DiscoveryState,
  KeywordDiscoveryChecks,
  KeywordDiscoveryCounts,
  KeywordDiscoveryItem,
  KeywordDiscoveryList,
  KeywordDiscoveryRefreshResult,
  KeywordDiscoveryTrackResult,
  Store,
} from "@asobeast/shared";
import { FIRST_CHECK_POLL_LIMIT, FIRST_CHECK_POLL_MS } from "./keyword-checks";
import { pluralize } from "./format";

const DAY_MS = 86_400_000;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const SOURCE_LABELS: Record<DiscoverySource, string> = {
  title: "Your title",
  subtitle: "Your subtitle",
  description: "Your description",
  competitors: "Competitors",
  reviews: "Reviews",
  popularity: "Apple popularity",
  portfolio: "Your other apps",
};

export function keywordDiscoveriesPollInterval(
  list: KeywordDiscoveryList | undefined,
  updates: number,
): number | false {
  if (!list || updates >= FIRST_CHECK_POLL_LIMIT) return false;
  return list.checks.pending > 0 ? FIRST_CHECK_POLL_MS : false;
}

export const visibleDiscoveries = (
  items: readonly KeywordDiscoveryItem[],
  state: DiscoveryState,
): KeywordDiscoveryItem[] =>
  state === "all" ? [...items] : items.filter((item) => item.state === state);

const lessBy = (count: number, removed: number): number =>
  Math.max(0, count - removed);

export function withoutDiscoveries(
  list: KeywordDiscoveryList,
  keywordIds: readonly string[],
): KeywordDiscoveryList {
  const ids = new Set(keywordIds);
  const removed = list.items.filter((item) => ids.has(item.keywordId));
  const removedIn = (state: KeywordDiscoveryItem["state"]): number =>
    removed.filter((item) => item.state === state).length;
  const ranked = removedIn("ranked");
  return {
    ...list,
    items: list.items.filter((item) => !ids.has(item.keywordId)),
    counts: {
      all: lessBy(list.counts.all, removed.length),
      ranked: lessBy(list.counts.ranked, ranked),
      opportunity: lessBy(list.counts.opportunity, removedIn("opportunity")),
    },
    unfit: lessBy(list.unfit, ranked),
  };
}

export const discoveryTabLabel = (
  counts: KeywordDiscoveryCounts | undefined,
): string => (counts ? `Discovered ${counts.all}` : "Discovered");

export const discoverySourceLabel = (
  source: DiscoverySource,
  store: Store,
): string =>
  source === "description" && store === "GOOGLE_PLAY"
    ? "Your short description"
    : SOURCE_LABELS[source];

const utcDayNumber = (instant: Date): number =>
  Math.floor(instant.getTime() / DAY_MS);

function checkedSentence(checkedAt: string | null, now: Date): string {
  if (checkedAt === null) return "Not checked yet.";
  const days = Math.max(
    0,
    utcDayNumber(now) - utcDayNumber(new Date(checkedAt)),
  );
  return days === 0
    ? "Checked today."
    : `Checked ${pluralize(days, "day")} ago.`;
}

function weeklySentence(checks: KeywordDiscoveryChecks): string {
  const used = checks.usedThisWeek > 0 ? `, ${checks.usedThisWeek} used` : "";
  const budget = `${pluralize(checks.perWeek, "check")} a week${used}`;
  if (checks.nextRunAt === null) return `${budget}. Weekly runs are off.`;
  const weekday = WEEKDAYS[new Date(checks.nextRunAt).getUTCDay()];
  return `${budget}; the next run is on ${weekday}.`;
}

export const discoveryFooter = (
  checks: KeywordDiscoveryChecks,
  now: Date,
): string =>
  `${checkedSentence(checks.checkedAt, now)} ${weeklySentence(checks)}`;

export const pendingChecksText = (pending: number): string =>
  pending > 0 ? `${pluralize(pending, "check")} pending` : "";

export const unfitNotice = (unfit: number): string =>
  unfit > 0 ? `${unfit} did not fit your plan` : "";

export function trackedToast({
  tracked,
  skipped,
}: KeywordDiscoveryTrackResult): string {
  if (tracked === 0) {
    return skipped > 0 ? "Nothing fit your plan" : "Nothing new to track";
  }
  const tracking = `Tracking ${pluralize(tracked, "keyword")}`;
  return skipped > 0 ? `${tracking}. ${unfitNotice(skipped)}.` : tracking;
}

export function refreshedToast({
  queued,
  resolved,
}: KeywordDiscoveryRefreshResult): string {
  if (queued > 0) return `Queued ${pluralize(queued, "check")}`;
  return resolved > 0
    ? "No checks to queue this week. The list was refreshed from other searches."
    : "Nothing new to check this week";
}

export function discoveriesLine(
  count: KeywordDiscoveryCount | undefined,
): string | null {
  if (!count || count.open === 0) return null;
  const found = pluralize(
    count.open,
    "keyword discovery",
    "keyword discoveries",
  );
  return count.ranked > 0
    ? `${found}, ${count.ranked} where you already rank`
    : found;
}

export const discoveriesHref = (appId: string, country?: string): string =>
  `/apps/${appId}/keywords?tab=discovered${country ? `&country=${country}` : ""}`;
