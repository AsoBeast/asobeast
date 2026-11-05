import type {
  WorkspaceChecklist,
  WorkspaceChecklistUpdateRequest,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function getWorkspaceChecklist(): Promise<WorkspaceChecklist> {
  return apiFetch<WorkspaceChecklist>("/workspace/checklist");
}

export function updateWorkspaceChecklist(
  patch: WorkspaceChecklistUpdateRequest,
): Promise<WorkspaceChecklist> {
  return apiFetch<WorkspaceChecklist>("/workspace/checklist", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
