import type {
  ActionItem,
  ActionListResult,
  ActionStatus,
  ActionUpdateRequest,
} from "@asobeast/shared";
import type { ActionFilters } from "@/lib/api";
import { ACTION_DEFAULT_STATUSES } from "@/lib/search-params";

export function listedStatuses(
  key: readonly unknown[],
): readonly ActionStatus[] {
  const filters = key[3] as ActionFilters | undefined;
  return filters?.status ?? ACTION_DEFAULT_STATUSES;
}

export function applyLocally(
  item: ActionItem,
  body: ActionUpdateRequest,
): ActionItem {
  return {
    ...item,
    status: body.status,
    snoozedUntil:
      body.status === "SNOOZED" ? (body.snoozedUntil ?? null) : null,
    note: body.note ?? item.note,
  };
}

export function applyToList(
  list: ActionListResult,
  statuses: readonly ActionStatus[],
  ids: ReadonlySet<string>,
  body: ActionUpdateRequest,
): ActionListResult {
  if (statuses.includes(body.status)) {
    return {
      ...list,
      items: list.items.map((item) =>
        ids.has(item.id) ? applyLocally(item, body) : item,
      ),
    };
  }
  const items = list.items.filter((item) => !ids.has(item.id));
  return {
    ...list,
    items,
    total: list.total - (list.items.length - items.length),
  };
}
