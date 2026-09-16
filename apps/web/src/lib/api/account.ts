import {
  DELETION_CONFIRMATION,
  type WorkspaceDeletionStatus,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function getWorkspaceDeletion(): Promise<WorkspaceDeletionStatus> {
  return apiFetch<WorkspaceDeletionStatus>("/account/deletion");
}

export function scheduleWorkspaceDeletion(): Promise<WorkspaceDeletionStatus> {
  return apiFetch<WorkspaceDeletionStatus>("/account/deletion", {
    method: "POST",
    body: JSON.stringify({ confirm: DELETION_CONFIRMATION }),
  });
}

export function cancelWorkspaceDeletion(): Promise<WorkspaceDeletionStatus> {
  return apiFetch<WorkspaceDeletionStatus>("/account/deletion", {
    method: "DELETE",
  });
}
