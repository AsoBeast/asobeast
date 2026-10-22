import type { AuthUser } from "@asobeast/shared";

export type AdminAccess =
  "granted" | "needs-plan" | "awaits-checkout" | "denied";

export type ClosedAdminAccess = Exclude<AdminAccess, "granted" | "denied">;

type AdminViewer = Pick<
  AuthUser,
  | "platformOperator"
  | "entitled"
  | "trialAwaitsConfirmation"
  | "trialAwaitsCheckout"
>;

export function adminAccessOf(viewer: AdminViewer | null): AdminAccess {
  if (!viewer?.platformOperator) return "denied";
  if (viewer.entitled) return "granted";
  return viewer.trialAwaitsCheckout === true ? "awaits-checkout" : "needs-plan";
}
