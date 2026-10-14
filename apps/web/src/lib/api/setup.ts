import type { AppSetupState, AppSetupUpdateRequest } from "@asobeast/shared";
import { apiFetch } from "./client";

export function getAppSetup(id: string): Promise<AppSetupState> {
  return apiFetch<AppSetupState>(`/apps/${id}/setup`);
}

export function updateAppSetup(
  id: string,
  patch: AppSetupUpdateRequest,
): Promise<AppSetupState> {
  return apiFetch<AppSetupState>(`/apps/${id}/setup`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
