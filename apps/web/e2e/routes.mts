const APP = "app-1";

export const SIGNED_IN_ROUTES = [
  ["portfolio", "/"],
  ["action-center", "/actions"],
  ["settings", "/settings"],
  ["upgrade", "/upgrade"],
  ["app-overview", `/apps/${APP}`],
  ["app-keywords", `/apps/${APP}/keywords`],
  ["app-rankings", `/apps/${APP}/rankings`],
  ["app-competitors", `/apps/${APP}/competitors`],
  ["app-audit", `/apps/${APP}/audit`],
  ["app-metadata", `/apps/${APP}/metadata`],
  ["app-changes", `/apps/${APP}/changes`],
  ["app-reviews", `/apps/${APP}/reviews`],
  ["app-actions", `/apps/${APP}/actions`],
  ["app-setup", `/apps/${APP}/setup`],
] as const;

export const SIGNED_OUT_ROUTES = [
  ["login", "/login", {}],
  ["register", "/register", { e2e_setup_required: "1" }],
  ["forgot-password", "/forgot-password", {}],
  ["reset-password", "/reset-password", {}],
  ["invite", "/invite", {}],
  ["verify", "/verify", {}],
] as const satisfies ReadonlyArray<
  readonly [string, string, Readonly<Record<string, string>>]
>;
