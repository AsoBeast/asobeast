import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { test as signedOut } from "./reporting.mts";
import { SIGNED_IN_ROUTES, SIGNED_OUT_ROUTES } from "./routes.mts";
import { ACTION_SUMMARY } from "./fixtures.mts";
import {
  NOT_STARTED_ONBOARDING,
  ONBOARDING_STORAGE_KEY,
  type OnboardingState,
} from "../src/lib/onboarding";

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

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function seedCookies(
  context: BrowserContext,
  cookies: Readonly<Record<string, string>>,
) {
  return context.addCookies(
    Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      domain: "localhost",
      path: "/",
    })),
  );
}

for (const [name, path] of SIGNED_IN_ROUTES) {
  test(`${name} hydrates without an uncaught error`, async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto(path);
    await page.waitForLoadState("networkidle");

    expect(errors, `${name} (${path}) threw: ${errors.join(", ")}`).toEqual([]);
  });
}

for (const [name, path, cookies] of SIGNED_OUT_ROUTES) {
  signedOut(
    `${name} hydrates without an uncaught error when signed out`,
    async ({ page, context }) => {
      await seedCookies(context, cookies);
      const errors = collectPageErrors(page);

      await page.goto(path);
      await page.waitForLoadState("networkidle");

      expect(new URL(page.url()).pathname, `${name} redirected away`).toBe(
        path,
      );
      expect(errors, `${name} (${path}) threw: ${errors.join(", ")}`).toEqual(
        [],
      );
    },
  );
}

function statTileText(html: string, label: string): string {
  const tile = (html.split(`>${label}<`).at(1) ?? "").split("</div>").at(0);
  return `<${tile ?? ""}`
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

test("the dashboard open action count is in the html the server sent", async ({
  page,
}) => {
  const html = await page.request.get("/").then((response) => response.text());

  expect(statTileText(html, "Open actions")).toBe(
    `${ACTION_SUMMARY.open} waiting on you`,
  );

  await page.goto("/");
  await expect(
    page.getByText("Open actions").locator("xpath=following-sibling::span[1]"),
  ).toHaveText(String(ACTION_SUMMARY.open));
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
  await seedCookies(context, { e2e_ai_audit: "1" });
  const errors = collectPageErrors(page);

  await page.goto("/apps/app-1/audit");
  await expect(page.getByText(/^Last run /)).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(errors, `the audit ai card threw: ${errors.join(", ")}`).toEqual([]);
});
