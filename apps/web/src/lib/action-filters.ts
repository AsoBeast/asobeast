export const TOP_ACTION_LIMIT = 3;

import type { ActionFilters } from "@/lib/api";
import {
  actionPriorityParser,
  actionRuleParser,
  actionStatusParser,
} from "@/lib/search-params";

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
