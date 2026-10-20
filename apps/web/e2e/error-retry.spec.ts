import type { Route } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const COMPARE_PATH = "/api/backend/apps/app-1/keywords/compare";

const isGapsRead = (url: URL) =>
  url.pathname === COMPARE_PATH && url.searchParams.get("onlyGaps") === "true";

test("try again refetches a comparison that failed after the competitors page was open", async ({
  page,
}) => {
  let failing = false;
  await page.route(isGapsRead, (route) =>
    failing
      ? route.fulfill({ status: 500, json: { statusCode: 500 } })
      : route.fallback(),
  );
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  failing = true;
  const onlyGaps = page.getByRole("switch", { name: "only gaps" });
  await hydrated(onlyGaps);
  await onlyGaps.click();
  const boundary = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: "Competitors could not be loaded" });
  await expect(boundary).toBeVisible({ timeout: 20_000 });

  failing = false;
  const refetched = page.waitForRequest((request) =>
    isGapsRead(new URL(request.url())),
  );
  await boundary.getByRole("button", { name: "Try again" }).click();
  await refetched;

  await expect(boundary).toBeHidden();
  await expect(page).toHaveURL(/onlyGaps=true/);
  await expect(
    page.getByRole("row").filter({ hasText: "productivity app" }),
  ).toBeVisible();
});

test("a double press on try again refetches once and keeps the page", async ({
  page,
}) => {
  let failing = false;
  await page.route(isGapsRead, (route) =>
    failing
      ? route.fulfill({ status: 500, json: { statusCode: 500 } })
      : route.fallback(),
  );
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  failing = true;
  const onlyGaps = page.getByRole("switch", { name: "only gaps" });
  await hydrated(onlyGaps);
  await onlyGaps.click();
  const boundary = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: "Competitors could not be loaded" });
  await expect(boundary).toBeVisible({ timeout: 20_000 });

  failing = false;
  await page.evaluate(() => {
    document.documentElement.dataset.kept = "true";
  });
  const reads: string[] = [];
  page.on("request", (request) => {
    if (isGapsRead(new URL(request.url()))) reads.push(request.url());
  });
  await boundary.getByRole("button", { name: "Try again" }).dblclick();

  await expect(boundary).toBeHidden();
  await expect(
    page.getByRole("row").filter({ hasText: "productivity app" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-kept", "true");
  expect(reads).toHaveLength(1);
});

const SHELL_PATHS = [
  "/api/backend/auth/status",
  "/api/backend/auth/me",
  "/api/backend/apps",
  "/api/backend/actions/summary",
  "/api/backend/health",
];

const isShellRead = (url: URL) => SHELL_PATHS.includes(url.pathname);

test("try again also recovers the shell reads that failed with the page", async ({
  page,
}) => {
  let failing = true;
  const answer = (route: Route) =>
    failing
      ? route.fulfill({ status: 500, json: { statusCode: 500 } })
      : route.fallback();
  await page.route(isShellRead, answer);
  await page.route(isGapsRead, answer);

  await page.goto("/apps/app-1/competitors");
  const onlyGaps = page.getByRole("switch", { name: "only gaps" });
  await hydrated(onlyGaps);
  await onlyGaps.click();
  const boundary = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: "Competitors could not be loaded" });
  await expect(boundary).toBeVisible({ timeout: 20_000 });

  const sidebar = page.getByRole("navigation", { name: "Main" });
  const admin = sidebar.getByRole("link", { name: "Admin", exact: true });
  const health = page.getByRole("banner").getByText("api", { exact: true });
  await expect(admin).toHaveCount(0);
  await expect(health).toHaveCount(0);

  failing = false;
  await boundary.getByRole("button", { name: "Try again" }).click();

  await expect(boundary).toBeHidden();
  await expect(
    sidebar.getByRole("button", { name: "Switch app, currently Focus Timer" }),
  ).toBeVisible();
  await expect(admin).toBeVisible();
  await expect(health).toBeVisible();
});
