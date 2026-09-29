import { QUERY_BOUNDS, type ActionStatus } from "@asobeast/shared";
import type { ActionActivityScope, ActionFilters } from "@/lib/api";
import {
  ACTION_DEFAULT_STATUSES,
  actionStatusParser,
} from "@/lib/search-params";

export const TOP_ACTION_LIMIT = 3;
export const DASHBOARD_ACTION_LIMIT = 5;
export const ACTION_QUEUE_LIMIT = QUERY_BOUNDS.actionsLimit.max;

export function actionActivityScope(appId?: string): ActionActivityScope {
  const days = QUERY_BOUNDS.actionActivityDays.default;
  return appId ? { appId, days } : { days };
}

export function queueFilters(
  status: readonly ActionStatus[] = ACTION_DEFAULT_STATUSES,
): ActionFilters {
  return { status: [...status], limit: ACTION_QUEUE_LIMIT };
}

export interface ActionSearchParams {
  status?: string | string[];
}

export function actionFiltersFrom(
  searchParams: ActionSearchParams,
): ActionFilters {
  return queueFilters(actionStatusParser.parseServerSide(searchParams.status));
}
