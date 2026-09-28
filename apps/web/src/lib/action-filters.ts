import { QUERY_BOUNDS } from "@asobeast/shared";
import type { ActionActivityScope, ActionFilters } from "@/lib/api";
import {
  actionPriorityParser,
  actionRuleParser,
  actionStatusParser,
} from "@/lib/search-params";

export const TOP_ACTION_LIMIT = 3;
export const DASHBOARD_ACTION_LIMIT = 5;

export function actionActivityScope(appId?: string): ActionActivityScope {
  const days = QUERY_BOUNDS.actionActivityDays.default;
  return appId ? { appId, days } : { days };
}

export interface ActionSearchParams {
  status?: string | string[];
  priority?: string | string[];
  rule?: string | string[];
}

export function actionFiltersFrom(
  searchParams: ActionSearchParams,
): ActionFilters {
  const status = actionStatusParser.parseServerSide(searchParams.status);
  const priority = actionPriorityParser.parseServerSide(searchParams.priority);
  const rule = actionRuleParser.parseServerSide(searchParams.rule);

  return {
    status,
    ...(priority.length > 0 ? { priority } : {}),
    ...(rule.length > 0 ? { rule } : {}),
  };
}
