import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  type ActionItem,
} from "@asobeast/shared";
import type { ActionGroup, ActionSort } from "@/lib/search-params";
import { ACTION_CATEGORY_LABEL, ACTION_PRIORITY_LABEL } from "./action-copy";
import { appLabel } from "./queue-filters";

export interface QueueGroup {
  key: string;
  label: string;
  items: ActionItem[];
}

const byImpact = (left: ActionItem, right: ActionItem): number =>
  right.impact - left.impact ||
  left.firstSeenAt.localeCompare(right.firstSeenAt) ||
  left.id.localeCompare(right.id);

const SORTS: Record<
  ActionSort,
  (left: ActionItem, right: ActionItem) => number
> = {
  impact: byImpact,
  newest: (left, right) =>
    right.firstSeenAt.localeCompare(left.firstSeenAt) || byImpact(left, right),
  oldest: (left, right) =>
    left.firstSeenAt.localeCompare(right.firstSeenAt) || byImpact(left, right),
};

export function sortQueue(
  items: readonly ActionItem[],
  sort: ActionSort,
): ActionItem[] {
  return [...items].sort(SORTS[sort]);
}

function inOrder<K extends string>(
  items: readonly ActionItem[],
  keys: readonly K[],
  keyOf: (item: ActionItem) => K,
  labels: Record<K, string>,
): QueueGroup[] {
  return keys.flatMap((key) => {
    const members = items.filter((item) => keyOf(item) === key);
    return members.length > 0
      ? [{ key, label: labels[key], items: members }]
      : [];
  });
}

const openCount = (group: QueueGroup): number =>
  group.items.filter((item) => item.status === "OPEN").length;

function byApp(items: readonly ActionItem[]): QueueGroup[] {
  const groups = new Map<string, QueueGroup>();
  for (const item of items) {
    const group = groups.get(item.scope.appId) ?? {
      key: item.scope.appId,
      label: appLabel(item.scope),
      items: [],
    };
    group.items.push(item);
    groups.set(group.key, group);
  }
  return [...groups.values()].sort(
    (left, right) =>
      openCount(right) - openCount(left) ||
      left.label.localeCompare(right.label),
  );
}

export function groupQueue(
  items: readonly ActionItem[],
  group: ActionGroup,
): QueueGroup[] {
  switch (group) {
    case "priority":
      return inOrder(
        items,
        ACTION_PRIORITIES,
        (item) => item.priority,
        ACTION_PRIORITY_LABEL,
      );
    case "category":
      return inOrder(
        items,
        ACTION_CATEGORIES,
        (item) => item.category,
        ACTION_CATEGORY_LABEL,
      );
    case "app":
      return byApp(items);
  }
}
