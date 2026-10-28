import type { AuthUser } from "@asobeast/shared";

export type AdminAccess = "granted" | "needs-plan" | "denied";

export type ClosedAdminAccess = Exclude<AdminAccess, "granted" | "denied">;

type AdminViewer = Pick<AuthUser, "platformOperator" | "entitled">;

export function adminAccessOf(viewer: AdminViewer | null): AdminAccess {
  if (!viewer?.platformOperator) return "denied";
  if (viewer.entitled) return "granted";
  return "needs-plan";
}
