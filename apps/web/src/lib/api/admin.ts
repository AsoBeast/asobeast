import type {
  AdminAppList,
  AdminOverview,
  AdminUserList,
  CapacityReport,
  ProxyPoolHealth,
  SupportWorkspaceSummary,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";

const byWorkspace = (workspaceId?: string) =>
  new URLSearchParams(workspaceId ? { workspaceId } : {});

export function getAdminOverview(): Promise<AdminOverview> {
  return apiFetch<AdminOverview>("/admin/support/overview");
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

export function getCapacityReport(): Promise<CapacityReport> {
  return apiFetch<CapacityReport>("/admin/capacity");
}

export function getProxyPool(): Promise<ProxyPoolHealth> {
  return apiFetch<ProxyPoolHealth>("/admin/proxy-pool");
}
