import type {
  ActionActivity,
  ActionAiStatus,
  ActionBulkUpdateRequest,
  ActionBulkUpdateResult,
  ActionCategory,
  ActionDetail,
  ActionExplanation,
  ActionItem,
  ActionListResult,
  ActionPriority,
  ActionRule,
  ActionRunResult,
  ActionStatus,
  ActionSummary,
  ActionUpdateRequest,
  Store,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

export interface ActionFilters {
  status?: ActionStatus[];
  priority?: ActionPriority[];
  rule?: ActionRule[];
  category?: ActionCategory;
  appId?: string;
  country?: string;
  store?: Store;
  limit?: number;
}

function actionParams(filters: ActionFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.priority?.length) {
    params.set("priority", filters.priority.join(","));
  }
  if (filters.rule?.length) params.set("rule", filters.rule.join(","));
  if (filters.category) params.set("category", filters.category);
  if (filters.appId) params.set("appId", filters.appId);
  if (filters.country) params.set("country", filters.country);
  if (filters.store) params.set("store", filters.store);
  if (filters.limit) params.set("limit", String(filters.limit));
  return params;
}

export function getActions(filters: ActionFilters): Promise<ActionListResult> {
  return apiFetch<ActionListResult>(
    withQuery("/actions", actionParams(filters)),
  );
}

export interface ActionSummaryScope {
  appId?: string;
  store?: Store;
  country?: string;
}

export function getActionSummary({
  appId,
  store,
  country,
}: ActionSummaryScope = {}): Promise<ActionSummary> {
  const params = new URLSearchParams();
  if (appId) params.set("appId", appId);
  if (store) params.set("store", store);
  if (country) params.set("country", country);
  return apiFetch<ActionSummary>(withQuery("/actions/summary", params));
}

export function getAppActions(
  appId: string,
  filters: ActionFilters,
): Promise<ActionListResult> {
  return apiFetch<ActionListResult>(
    withQuery(`/apps/${appId}/actions`, actionParams(filters)),
  );
}

export function updateAction(
  id: string,
  body: ActionUpdateRequest,
): Promise<ActionItem> {
  return apiFetch<ActionItem>(`/actions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getAction(id: string): Promise<ActionDetail> {
  return apiFetch<ActionDetail>(`/actions/${encodeURIComponent(id)}`);
}

export interface ActionActivityScope extends ActionSummaryScope {
  days?: number;
}

export function getActionActivity({
  appId,
  store,
  country,
  days,
}: ActionActivityScope = {}): Promise<ActionActivity> {
  const params = new URLSearchParams();
  if (appId) params.set("appId", appId);
  if (store) params.set("store", store);
  if (country) params.set("country", country);
  if (days !== undefined) params.set("days", String(days));
  return apiFetch<ActionActivity>(withQuery("/actions/activity", params));
}

export function bulkUpdateActions(
  body: ActionBulkUpdateRequest,
): Promise<ActionBulkUpdateResult> {
  return apiFetch<ActionBulkUpdateResult>("/actions", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function runActions(): Promise<ActionRunResult> {
  return apiFetch<ActionRunResult>("/actions/run", { method: "POST" });
}

export function getActionAiStatus(): Promise<ActionAiStatus> {
  return apiFetch<ActionAiStatus>("/actions/ai-status");
}

export function explainAction(id: string): Promise<ActionExplanation> {
  return apiFetch<ActionExplanation>(`/actions/${id}/explain`, {
    method: "POST",
  });
}
