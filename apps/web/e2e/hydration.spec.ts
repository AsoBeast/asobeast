import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { test as signedOut } from "./reporting.mts";
import {
  appRoutesFor,
  seedCookies,
  SIGNED_IN_ROUTES,
  SIGNED_OUT_ROUTES,
  WORKSPACE_ROUTES,
} from "./routes.mts";
import {
  ACTION_SUMMARY,
  APP_1_RATINGS_HISTOGRAM,
  FIRST_RUN_UNSCHEDULED,
} from "./fixtures.mts";
import { collectPageErrors, expectHydratesCleanly } from "./page-errors.mts";
import { firstRunHeadline } from "../src/components/onboarding/first-run-timeline";
import { formatNumber } from "../src/lib/format";
import {
  NOT_STARTED_ONBOARDING,
  ONBOARDING_STORAGE_KEY,
  type OnboardingState,
} from "../src/lib/onboarding";

const SLOW_API_MS = 300;
const SLOW_FIRST_RUN_MS = 1000;
const APP_ERROR_TITLE = "This app could not be loaded";
const PRINT_REPORT = "Print report";
const HYDRATION_APPS = [
  "app-1",
  "app-2",
  "app-new",
  "app-long",
  "app-gp",
] as const;

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

const IN_PROGRESS_ONBOARDING: OnboardingState = {
  ...NOT_STARTED_ONBOARDING,
  status: "in_progress",
  appId: "app-1",
  selectedMarkets: ["us"],
};

const DEEP_LINKS = [
  {
    name: "a reviews star filter",
    url: "/apps/app-1/reviews?score=3",
    endpoint: "/api/backend/apps/app-1/reviews",
    ready: (page: Page) => page.getByText("No reviews match these filters"),
  },
  {
    name: "an overview category range",
    url: "/apps/app-1?categoryRange=7d",
    endpoint: "/api/backend/apps/app-1/category-ranks",
    ready: (page: Page) =>
      page.getByRole("region", { name: "Category chart position over time" }),
  },
  {
    name: "a competitor gaps filter",
    url: "/apps/app-1/competitors?onlyGaps=true",
    endpoint: "/api/backend/apps/app-1/keywords/compare",
    ready: (page: Page) => page.getByRole("table"),
  },
  {
    name: "a change impact window",
    url: "/apps/app-1/changes?days=30",
    endpoint: "/api/backend/apps/app-1/changes/impact",
    ready: (page: Page) =>
      page.getByRole("heading", { level: 4, name: "After 7 days" }),
  },
  {
    name: "the action queue",
    url: "/actions",
    endpoint: "/api/backend/actions",
    ready: (page: Page) => page.locator("[id='action-act-uncovered']"),
  },
  {
    name: "an app action queue",
    url: "/apps/app-1/actions",
    endpoint: "/api/backend/apps/app-1/actions",
    ready: (page: Page) => page.locator("[id='action-act-uncovered']"),
  },
  {
    name: "a change timeline window",
    url: "/apps/app-1/changes?days=30",
    endpoint: "/api/backend/apps/app-1/changes",
    ready: (page: Page) => page.getByText("Focus Timer Pro"),
  },
] as const;

for (const { name, url, endpoint, ready } of DEEP_LINKS) {
  test(`${name} hydrates from the server without refetching`, async ({
    page,
  }) => {
    const refetched: string[] = [];
    page.on("request", (request) => {
      const target = new URL(request.url());
      if (target.pathname === endpoint && target.search) {
        refetched.push(target.pathname + target.search);
      }
    });

    await page.goto(url);
    await expect(ready(page).first()).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(refetched).toEqual([]);
  });
}

for (const url of ["/apps/app-1", "/apps/app-1/actions"]) {
  test(`${url} names the app in its header and breadcrumb without refetching it`, async ({
    page,
  }) => {
    const refetched: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/backend/apps/app-1") {
        refetched.push(request.url());
      }
    });

    await page.goto(url);
    await expect(
      page.getByRole("heading", { level: 1, name: "Focus Timer" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" }),
    ).toContainText("Focus Timer");
    await page.waitForLoadState("networkidle");

    expect(refetched).toEqual([]);
  });
}

for (const [name, path] of SIGNED_IN_ROUTES) {
  test(`${name} hydrates without an uncaught error`, async ({ page }) => {
    await expectHydratesCleanly(page, name, path);
  });
}

for (const [name, path, cookies] of SIGNED_OUT_ROUTES) {
  signedOut(
    `${name} hydrates without an uncaught error when signed out`,
    async ({ page, context }) => {
      await seedCookies(context, cookies);
      await expectHydratesCleanly(page, name, path);
    },
  );
}

function textOf(markup: string): string {
  return `<${markup}`
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sectionText(html: string, label: string, closer: string): string {
  const after = html.split(`>${label}<`).at(1) ?? "";
  return textOf(after.split(closer).at(0) ?? "");
}

test("the dashboard open action count is in the html the server sent", async ({
  page,
}) => {
  const html = await page.request.get("/").then((response) => response.text());

  const { critical, high } = ACTION_SUMMARY.openByPriority;
  expect(sectionText(html, "Open actions", "</div>")).toBe(
    `${ACTION_SUMMARY.open} ${critical} critical · ${high} high`,
  );

  await page.goto("/");
  await expect(
    page.getByText("Open actions").locator("xpath=following-sibling::span[1]"),
  ).toHaveText(String(ACTION_SUMMARY.open));
});

test("the settings plan section is in the html the server sent while billing is on", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_billing: "1" });
  const errors = collectPageErrors(page);

  const html = await page.request
    .get("/settings")
    .then((response) => response.text());
  expect(html).toContain('id="plan"');

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Plan" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(errors, `the settings page threw: ${errors.join(", ")}`).toEqual([]);
});

test("settings hydrates after the shell has already loaded the session", async ({
  page,
  context,
  request,
}) => {
  const hold = randomUUID();
  await seedCookies(context, { e2e_budget_hold: hold });
  const errors = collectPageErrors(page);

  await page.goto("/settings", { waitUntil: "commit" });
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  await request.post(`${MOCK_API_URL}/__budget-holds/${hold}/release`);
  await expect(page.getByText("API tokens", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(errors, `the settings page threw: ${errors.join(", ")}`).toEqual([]);
});

test("a stored onboarding checklist hydrates without an uncaught error", async ({
  page,
  context,
}) => {
  await context.addInitScript(
    ([key, state]) => window.localStorage.setItem(key, state),
    [ONBOARDING_STORAGE_KEY, JSON.stringify(IN_PROGRESS_ONBOARDING)] as const,
  );
  const errors = collectPageErrors(page);

  await page.goto("/");
  await expect(page.getByText("Finish setting up")).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(errors, `the onboarding banner threw: ${errors.join(", ")}`).toEqual(
    [],
  );
});

test("a seconds-old audit timestamp renders the same on both sides", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_ai_run: "running" });
  const errors = collectPageErrors(page);

  await page.goto("/apps/app-1/audit");
  await expect(page.getByText(/^Analyzed /)).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(errors, `the audit ai card threw: ${errors.join(", ")}`).toEqual([]);
});

test("the ratings histogram is in the html the server sent", async ({
  page,
}) => {
  const errors = collectPageErrors(page);
  const total = formatNumber(APP_1_RATINGS_HISTOGRAM.total ?? 0);

  const html = await page.request
    .get("/apps/app-1/reviews")
    .then((response) => response.text());
  expect(sectionText(html, "Ratings distribution", "</ul>")).toContain(
    `${total} ratings`,
  );

  await page.goto("/apps/app-1/reviews");
  await expect(page.getByText(`${total} ratings`)).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(errors, `the ratings histogram threw: ${errors.join(", ")}`).toEqual(
    [],
  );
});

for (const [label, cookies] of [
  ["queued", { e2e_ai_run: "queued" }],
  ["stale", { e2e_ai_stale: "1" }],
  ["unconfigured", { e2e_ai_unconfigured: "1" }],
] as const) {
  test(`the audit page hydrates with a ${label} analysis`, async ({
    page,
    context,
  }) => {
    await seedCookies(context, cookies);
    const errors = collectPageErrors(page);

    await page.goto("/apps/app-1/audit");
    await expect(
      page.getByRole("region", { name: "AI creative analysis" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(errors, `the audit page threw: ${errors.join(", ")}`).toEqual([]);
  });
}

test.describe("while the api is slow", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ context }) => {
    await seedCookies(context, { e2e_api_latency: String(SLOW_API_MS) });
  });

  for (const [name, path] of [
    ...WORKSPACE_ROUTES,
    ...HYDRATION_APPS.flatMap(appRoutesFor),
  ]) {
    test(`${name} hydrates without an uncaught error`, async ({ page }) => {
      const errors = collectPageErrors(page);

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(new URL(page.url()).pathname, `${name} redirected away`).toBe(
        path,
      );
      expect(errors, `${name} (${path}) threw: ${errors.join(", ")}`).toEqual(
        [],
      );
    });
  }

  test("an overview whose first run status fails hydrates without the card", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_first_run_fail: "1" });
    const errors = collectPageErrors(page);
    const headline = firstRunHeadline(FIRST_RUN_UNSCHEDULED);

    const html = await page.request
      .get("/apps/app-2")
      .then((response) => response.text());
    expect(html).toContain(PRINT_REPORT);
    expect(html).not.toContain(headline);

    await page.goto("/apps/app-2");
    await expect(
      page.getByRole("button", { name: PRINT_REPORT }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(errors, `the overview threw: ${errors.join(", ")}`).toEqual([]);
    await expect(page.getByText(APP_ERROR_TITLE)).toHaveCount(0);
    await expect(page.getByText(headline)).toHaveCount(0);
  });
});

test("the first run card is in the html the server sent while its status is slow", async ({
  page,
  context,
}) => {
  await seedCookies(context, {
    e2e_first_run_latency: String(SLOW_FIRST_RUN_MS),
  });

  const html = await page.request
    .get("/apps/app-2")
    .then((response) => response.text());

  expect(html).toContain(firstRunHeadline(FIRST_RUN_UNSCHEDULED));
});
