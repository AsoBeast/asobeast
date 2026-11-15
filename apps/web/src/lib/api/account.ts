import {
  DELETION_CONFIRMATION,
  type DeletionReason,
  type WorkspaceDeletionRequest,
  type WorkspaceDeletionStatus,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function getWorkspaceDeletion(): Promise<WorkspaceDeletionStatus> {
  return apiFetch<WorkspaceDeletionStatus>("/account/deletion");
}

export function scheduleWorkspaceDeletion(
  reason?: DeletionReason,
): Promise<WorkspaceDeletionStatus> {
  const request: WorkspaceDeletionRequest = reason
    ? { confirm: DELETION_CONFIRMATION, reason }
    : { confirm: DELETION_CONFIRMATION };
  return apiFetch<WorkspaceDeletionStatus>("/account/deletion", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function cancelWorkspaceDeletion(): Promise<WorkspaceDeletionStatus> {
  return apiFetch<WorkspaceDeletionStatus>("/account/deletion", {
    method: "DELETE",
  });
}
