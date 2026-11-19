import type {
  AdminAppList,
  AdminConversion,
  AdminConversionWindow,
  AdminDepartureList,
  AdminOverview,
  AdminUserList,
  CapacityReport,
  ProxyPoolHealth,
  SupportActionRequest,
  SupportActionResult,
  SupportWorkspaceDetail,
  SupportWorkspaceSummary,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

const byWorkspace = (workspaceId?: string) =>
  new URLSearchParams(workspaceId ? { workspaceId } : {});

export function getAdminOverview(): Promise<AdminOverview> {
  return apiFetch<AdminOverview>("/admin/support/overview");
}

export function getAdminConversion(
  days: AdminConversionWindow,
): Promise<AdminConversion> {
  return apiFetch<AdminConversion>(
    withQuery(
      "/admin/support/conversion",
      new URLSearchParams({ days: String(days) }),
    ),
  );
}

export function getAdminDepartures(): Promise<AdminDepartureList> {
  return apiFetch<AdminDepartureList>("/admin/support/departures");
}

export function getAdminUsers(workspaceId?: string): Promise<AdminUserList> {
  return apiFetch<AdminUserList>(
    withQuery("/admin/support/users", byWorkspace(workspaceId)),
  );
}

export function getAdminApps(workspaceId?: string): Promise<AdminAppList> {
  return apiFetch<AdminAppList>(
    withQuery("/admin/support/apps", byWorkspace(workspaceId)),
  );
}

export function getSupportWorkspaces(): Promise<SupportWorkspaceSummary[]> {
  return apiFetch<SupportWorkspaceSummary[]>("/admin/support/workspaces");
}

const supportWorkspacePath = (workspaceId: string) =>
  `/admin/support/workspaces/${encodeURIComponent(workspaceId)}`;

export function getSupportWorkspace(
  workspaceId: string,
): Promise<SupportWorkspaceDetail> {
  return apiFetch<SupportWorkspaceDetail>(supportWorkspacePath(workspaceId));
}

function postSupportAction(
  workspaceId: string,
  action: string,
  request: SupportActionRequest,
): Promise<SupportActionResult> {
  return apiFetch<SupportActionResult>(
    `${supportWorkspacePath(workspaceId)}/${action}`,
    { method: "POST", body: JSON.stringify(request) },
  );
}

export function suspendSupportWorkspace(
  workspaceId: string,
  request: SupportActionRequest,
): Promise<SupportActionResult> {
  return postSupportAction(workspaceId, "suspend", request);
}

export function restoreSupportWorkspace(
  workspaceId: string,
  request: SupportActionRequest,
): Promise<SupportActionResult> {
  return postSupportAction(workspaceId, "restore", request);
}

export function getCapacityReport(): Promise<CapacityReport> {
  return apiFetch<CapacityReport>("/admin/capacity");
}

export function getProxyPool(): Promise<ProxyPoolHealth> {
  return apiFetch<ProxyPoolHealth>("/admin/proxy-pool");
}
