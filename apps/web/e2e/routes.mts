import { readdirSync } from "node:fs";
import { join } from "node:path";
import { OFFERED_PLAN, TRIALING_PLAN, planCookie } from "./trial-plans.mts";
import type { BrowserContext } from "@playwright/test";

export const APP = "app-1";

export const SIGNED_IN_ROUTES = [
  ["portfolio", "/"],
  ["action-center", "/actions"],
  ["top-charts", "/charts"],
  ["settings", "/settings"],
  ["integrations", "/integrations"],
  ["integrations-google-play", "/integrations/google-play"],
  ["upgrade", "/upgrade"],
  ["admin-overview", "/admin"],
  ["admin-capacity", "/admin/capacity"],
  ["admin-workspaces", "/admin/workspaces"],
  ["admin-users", "/admin/users"],
  ["admin-apps", "/admin/apps"],
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

const APP_ROUTE_PREFIX = `/apps/${APP}`;

const isAppRoute = ([, path]: (typeof SIGNED_IN_ROUTES)[number]) =>
  path.startsWith(APP_ROUTE_PREFIX);

export const WORKSPACE_ROUTES = SIGNED_IN_ROUTES.filter(
  (route) => !isAppRoute(route),
);

const APP_ROUTES = SIGNED_IN_ROUTES.filter(isAppRoute);

export const appRoutesFor = (
  appId: string,
): ReadonlyArray<readonly [string, string]> =>
  APP_ROUTES.map(
    ([name, path]) =>
      [
        `${name} of ${appId}`,
        path.replace(APP_ROUTE_PREFIX, `/apps/${appId}`),
      ] as const,
  );

export const SIGNED_OUT_ROUTES = [
  ["login", "/login", {}],
  ["register", "/register", { e2e_setup_required: "1" }],
  ["forgot-password", "/forgot-password", {}],
  ["reset-password", "/reset-password", {}],
  ["invite", "/invite", {}],
  ["verify", "/verify", {}],
  ["unsubscribe", "/unsubscribe", {}],
  ["confirm-alert", "/confirm-alert", {}],
] as const satisfies ReadonlyArray<
  readonly [string, string, Readonly<Record<string, string>>]
>;

export const TRIAL_ROUTES = [
  [
    "portfolio offering the trial",
    "/",
    {
      e2e_viewer: "checkout-pending",
      e2e_billing: "1",
      e2e_plan: planCookie(OFFERED_PLAN),
    },
  ],
  [
    "wall offering the trial",
    "/upgrade",
    {
      e2e_viewer: "checkout-pending-unconfirmed",
      e2e_billing: "1",
      e2e_plan: planCookie(OFFERED_PLAN),
    },
  ],
  [
    "portfolio while trialing",
    "/",
    {
      e2e_viewer: "trialing",
      e2e_billing: "1",
      e2e_plan: planCookie(TRIALING_PLAN),
    },
  ],
  [
    "settings while trialing",
    "/settings",
    {
      e2e_viewer: "trialing",
      e2e_billing: "1",
      e2e_plan: planCookie(TRIALING_PLAN),
    },
  ],
  [
    "wall while trialing",
    "/upgrade",
    {
      e2e_viewer: "trialing",
      e2e_billing: "1",
      e2e_plan: planCookie(TRIALING_PLAN),
    },
  ],
] as const satisfies ReadonlyArray<
  readonly [string, string, Readonly<Record<string, string>>]
>;

export const DEV_ONLY_ROUTES = [["tokens", "/tokens"]] as const;

const APP_DIR = join(__dirname, "../src/app");

function routeOf(segments: string[]): string {
  const path = segments
    .filter((segment) => !segment.startsWith("("))
    .map((segment) => (segment.startsWith("[") ? APP : segment))
    .join("/");
  return `/${path}`;
}

function routesUnder(dir: string, segments: string[]): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(
        ...routesUnder(join(dir, entry.name), [...segments, entry.name]),
      );
    } else if (entry.name === "page.tsx") {
      found.push(routeOf(segments));
    }
  }
  return found;
}

export const pageRoutes = (): string[] => routesUnder(APP_DIR, []);

export function seedCookies(
  context: BrowserContext,
  cookies: Readonly<Record<string, string>>,
): Promise<void> {
  return context.addCookies(
    Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
    })),
  );
}
