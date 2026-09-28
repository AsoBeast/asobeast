import type {
  ActionPriority,
  ActionRule,
  ActionStatus,
} from "@asobeast/shared";
import { ACTION_DEFAULT_STATUSES } from "@/lib/search-params";

export function isDefaultStatusSet(status: readonly ActionStatus[]): boolean {
  return (
    status.length === ACTION_DEFAULT_STATUSES.length &&
    ACTION_DEFAULT_STATUSES.every((value) => status.includes(value))
  );
}

export function isFilteredView(view: {
  status: readonly ActionStatus[];
  priority: readonly ActionPriority[];
  rule: readonly ActionRule[];
}): boolean {
  return (
    !isDefaultStatusSet(view.status) ||
    view.priority.length > 0 ||
    view.rule.length > 0
  );
}
