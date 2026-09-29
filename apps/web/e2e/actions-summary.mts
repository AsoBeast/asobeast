import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  ACTION_STATUSES,
  type ActionItem,
  type ActionRule,
  type ActionSummary,
} from "@asobeast/shared";

const TOP_RULES_LIMIT = 5;

function tally<K extends string>(
  keys: readonly K[],
  values: readonly K[],
): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<
    K,
    number
  >;
  for (const value of values) counts[value] += 1;
  return counts;
}

function topRules(
  live: readonly ActionItem[],
): Array<{ rule: ActionRule; count: number }> {
  const counts = new Map<ActionRule, number>();
  for (const action of live) {
    counts.set(action.rule, (counts.get(action.rule) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([rule, count]) => ({ rule, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.rule.localeCompare(right.rule),
    )
    .slice(0, TOP_RULES_LIMIT);
}

export function summarizeActions(
  actions: readonly ActionItem[],
  run: { generatedAt: string | null; suppressedByCap: number },
): ActionSummary {
  const live = actions.filter(
    (action) => action.status === "OPEN" || action.status === "SNOOZED",
  );
  const open = actions.filter((action) => action.status === "OPEN");
  const byStatus = tally(
    ACTION_STATUSES,
    actions.map((action) => action.status),
  );
  return {
    open: byStatus.OPEN,
    snoozed: byStatus.SNOOZED,
    byPriority: tally(
      ACTION_PRIORITIES,
      live.map((action) => action.priority),
    ),
    byCategory: tally(
      ACTION_CATEGORIES,
      live.map((action) => action.category),
    ),
    topRules: topRules(live),
    generatedAt: run.generatedAt,
    suppressedByCap: run.suppressedByCap,
    openByPriority: tally(
      ACTION_PRIORITIES,
      open.map((action) => action.priority),
    ),
    byStatus,
  };
}
