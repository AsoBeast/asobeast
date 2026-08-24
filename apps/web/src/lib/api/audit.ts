import type { AppAuditResult, AuditHistory } from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";
import type { RangeParams } from "./client";

export function getAudit(appId: string): Promise<AppAuditResult> {
  return apiFetch<AppAuditResult>(`/apps/${appId}/audit`);
}

export function getAuditHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<AuditHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<AuditHistory>(
    withQuery(`/apps/${appId}/audit/history`, params),
  );
}

export function runAiAudit(appId: string): Promise<AppAuditResult> {
  return apiFetch<AppAuditResult>(`/apps/${appId}/audit/ai`, {
    method: "POST",
  });
}
