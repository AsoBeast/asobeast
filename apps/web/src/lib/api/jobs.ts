import type {
  DailyBudget,
  HealthStatus,
  RunDailyResult,
  SnapshotDiffResult,
  WorkspaceRunStatus,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function refreshApp(id: string): Promise<SnapshotDiffResult> {
  return apiFetch<SnapshotDiffResult>(`/apps/${id}/refresh`, {
    method: "POST",
  });
}

export function runDaily(id: string): Promise<RunDailyResult> {
  return apiFetch<RunDailyResult>(`/apps/${id}/run-daily`, { method: "POST" });
}

export function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health");
}

export function getBudget(): Promise<DailyBudget> {
  return apiFetch<DailyBudget>("/jobs/budget");
}

export function getRunStatus(): Promise<WorkspaceRunStatus> {
  return apiFetch<WorkspaceRunStatus>("/jobs/run-status");
}
