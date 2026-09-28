import type {
  ActionActivity,
  ActionActivityCounts,
  ActionActivityDay,
  ActionEventItem,
  ActionEventType,
  ActionItem,
  ActionOutcome,
  ActionOutcomeVerdict,
  ActionTrend,
  ActionTrendMetric,
} from "@asobeast/shared";

const DAY_MS = 86_400_000;
const LAST_DAY = Date.UTC(2026, 6, 30);
const TREND_DAYS = 35;
const ACTIVITY_DAYS = 30;

const dayKey = (offset: number): string =>
  new Date(LAST_DAY - offset * DAY_MS).toISOString().slice(0, 10);

const offsetOf = (iso: string): number =>
  Math.round((LAST_DAY - Date.parse(iso.slice(0, 10))) / DAY_MS);

function event(
  item: ActionItem,
  type: ActionEventType,
  occurredAt: string,
  overrides: Partial<ActionEventItem> = {},
): ActionEventItem {
  const user = type !== "opened" && type !== "resolved" && type !== "verified";
  return {
    id: `${item.id}-${type}-${occurredAt}`,
    type,
    actor: user ? "user" : "system",
    actorName: user ? "Anna" : null,
    occurredAt,
    status: item.status,
    priority: item.priority,
    impact: item.impact,
    snoozedUntil: null,
    reason: null,
    ...overrides,
  };
}

function laterEvents(item: ActionItem): ActionEventItem[] {
  switch (item.id) {
    case "act-reopened":
      return [
        event(item, "done", "2026-07-21T09:00:00.000Z", { status: "DONE" }),
        event(item, "reopened", "2026-07-22T03:00:00.000Z", {
          actor: "system",
          actorName: null,
          status: "OPEN",
        }),
        event(item, "done", "2026-07-23T09:00:00.000Z", { status: "DONE" }),
        event(item, "reopened", "2026-07-25T03:00:00.000Z", {
          actor: "system",
          actorName: null,
          status: "OPEN",
        }),
      ];
    case "act-snoozed":
      return [
        event(item, "snoozed", "2026-07-26T10:00:00.000Z", {
          snoozedUntil: item.snoozedUntil,
        }),
      ];
    case "act-dismissed":
      return [
        event(item, "dismissed", item.closedAt ?? item.lastSeenAt, {
          reason: "not_relevant",
        }),
      ];
    default:
      return item.status === "DONE" ? doneEvents(item) : [];
  }
}

function doneEvents(item: ActionItem): ActionEventItem[] {
  const done = event(item, "done", item.closedAt ?? item.lastSeenAt);
  return item.verifiedAt
    ? [done, event(item, "verified", item.verifiedAt)]
    : [done];
}

export function initialActionEvents(
  actions: readonly ActionItem[],
): Record<string, ActionEventItem[]> {
  return Object.fromEntries(
    actions.map((item) => [
      item.id,
      [
        event(item, "opened", item.firstSeenAt, { status: "OPEN" }),
        ...laterEvents(item),
      ],
    ]),
  );
}

const TREND_METRIC: Record<ActionItem["rule"], ActionTrendMetric> = {
  "keyword.add_uncovered": "position",
  "keyword.defend": "position",
  "keyword.prune": "position",
  "rank.investigate_drop": "visibility",
  "serp.hold_volatile": "position",
  "audit.fix_factor": "audit",
  "reviews.investigate_theme": "rating",
  "market.improve_country": "visibility",
  "keyword.push_to_top10": "position",
  "metadata.fix_lint": "audit",
  "rank.investigate_unexplained_drop": "visibility",
  "competitor.investigate_overtake": "position",
  "reviews.investigate_rating_decline": "rating",
};

const PATHS: Record<string, (offset: number) => number | null> = {
  "act-uncovered": (offset) => Math.round(12 + (6 * offset) / TREND_DAYS),
  "act-done-confirmed": (offset) => (offset >= 10 ? 16 : 7),
  "act-prune": () => null,
  "act-drop": (offset) => (offset > 10 ? 42 : 31),
  "act-market": (offset) => Math.round(18 + (TREND_DAYS - offset) / 5),
  "act-reviews": (offset) => Math.round((3.9 + offset / 70) * 100) / 100,
  "act-done-verifying": (offset) => (offset >= 1 ? 58 : 61),
};

const FALLBACK: Record<ActionTrendMetric, (offset: number) => number | null> = {
  position: (offset) => 6 + (offset % 3),
  visibility: (offset) => 40 + (offset % 4),
  audit: (offset) => (offset % 2 === 0 ? 55 : 56),
  rating: () => 4.2,
  updateAge: (offset) => 60 + (TREND_DAYS - offset),
};

export function trendFor(item: ActionItem): ActionTrend | null {
  if (item.degraded) return null;
  const metric = TREND_METRIC[item.rule];
  const valueAt = PATHS[item.id] ?? FALLBACK[metric];
  return {
    metric,
    direction:
      metric === "position" || metric === "updateAge"
        ? "lower_is_better"
        : "higher_is_better",
    depth: metric === "position" ? 200 : null,
    points: Array.from({ length: TREND_DAYS + 1 }, (_, index) => {
      const offset = TREND_DAYS - index;
      return { date: dayKey(offset), checked: true, value: valueAt(offset) };
    }),
  };
}

const VERDICTS: Record<string, ActionOutcomeVerdict> = {
  "act-done-confirmed": "improved",
  "act-done-verifying": "pending",
};

export function outcomeFor(
  item: ActionItem,
  trend: ActionTrend | null,
): ActionOutcome | null {
  if (item.status !== "DONE" || !item.closedAt || !trend) return null;
  const closed = offsetOf(item.closedAt);
  const before = trend.points.find((point) => point.date === dayKey(closed));
  const after = trend.points.at(-1);
  const change =
    before && after && before.value !== null && after.value !== null
      ? Math.round((after.value - before.value) * 10) / 10
      : null;
  return {
    metric: trend.metric,
    direction: trend.direction,
    before: before?.value ?? null,
    beforeDate: before?.date ?? null,
    after: after?.value ?? null,
    afterDate: after?.date ?? null,
    change,
    verdict: VERDICTS[item.id] ?? "pending",
  };
}

const ZERO: ActionActivityCounts = {
  opened: 0,
  reopened: 0,
  done: 0,
  dismissed: 0,
  resolved: 0,
  verified: 0,
};

const ACTIVE_DAYS: Record<number, Partial<ActionActivityCounts>> = {
  0: { opened: 1, dismissed: 1 },
  2: { opened: 2, done: 1 },
  5: { reopened: 1, resolved: 1 },
  9: { opened: 3, verified: 1 },
  10: { done: 2 },
  16: { opened: 4, resolved: 2 },
  23: { opened: 2, dismissed: 1 },
  28: { opened: 3 },
};

function activityDays(active: boolean): ActionActivityDay[] {
  return Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
    const offset = ACTIVITY_DAYS - 1 - index;
    return {
      date: dayKey(offset),
      ...ZERO,
      ...(active ? ACTIVE_DAYS[offset] : {}),
    };
  });
}

function activityOf(days: ActionActivityDay[]): ActionActivity {
  const totals = days.reduce<ActionActivityCounts>(
    (sum, day) => ({
      opened: sum.opened + day.opened,
      reopened: sum.reopened + day.reopened,
      done: sum.done + day.done,
      dismissed: sum.dismissed + day.dismissed,
      resolved: sum.resolved + day.resolved,
      verified: sum.verified + day.verified,
    }),
    ZERO,
  );
  return {
    from: days[0].date,
    to: days[days.length - 1].date,
    days,
    totals,
  };
}

export const ACTION_ACTIVITY: ActionActivity = activityOf(activityDays(true));

export const EMPTY_ACTION_ACTIVITY: ActionActivity = activityOf(
  activityDays(false),
);
