import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { hoverForTooltip } from "./hover.mts";
import { databaseDownAnswer } from "./fixtures.mts";
import { seedSession } from "./plan-helpers.mts";
import { seedViewer } from "./viewer.mts";

const POLL_STEP_MS = 5_000;

function pollUntilShown(page: Page, label: string, timeout = 20_000) {
  const header = page.getByRole("banner");
  return expect(async () => {
    await page.clock.runFor(POLL_STEP_MS);
    await expect(header.getByText(label, { exact: true })).toBeVisible({
      timeout: 500,
    });
  }).toPass({ timeout });
}

const GATEWAY_ANSWERS = [
  [502, "Bad Gateway", "The API is unreachable."],
  [504, "Gateway Timeout", "The API did not respond in time."],
] as const;

test.describe("api status badge", () => {
  test("is shown to the platform operator", async ({ page }) => {
    await seedSession(page);
    await page.goto("/settings");

    await expect(
      page.getByRole("banner").getByText("api", { exact: true }),
    ).toBeVisible();
  });

  for (const viewer of ["customer", "member"] as const) {
    test(`is hidden from a ${viewer} and never polls health`, async ({
      page,
      context,
    }) => {
      const healthChecks: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/backend/health")) {
          healthChecks.push(request.url());
        }
      });
      await seedSession(page);
      await seedViewer(context, viewer);
      await page.goto("/settings");
      await expect(
        page.getByRole("button", { name: "Account menu" }),
      ).toBeVisible();

      await expect(
        page.getByRole("banner").getByText("api", { exact: true }),
      ).toHaveCount(0);
      expect(healthChecks).toEqual([]);
    });
  }

  test("reads unreachable once a later poll fails and recovers on the next answer", async ({
    page,
  }) => {
    const header = page.getByRole("banner");
    await page.clock.install();
    await seedSession(page);
    await page.goto("/settings");
    await expect(header.getByText("api", { exact: true })).toBeVisible();

    await page.route("**/api/backend/health", (route) => route.abort());
    await pollUntilShown(page, "unreachable");
    await expect(header.locator("svg.lucide-circle-x")).toHaveCount(1);

    await page.unroute("**/api/backend/health");
    await pollUntilShown(page, "api");
  });
  test("reads unreachable after the first failed poll without retrying it", async ({
    page,
  }) => {
    const header = page.getByRole("banner");
    const healthReads: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/backend/health") {
        healthReads.push(request.url());
      }
    });
    await page.clock.install();
    await seedSession(page);
    await page.goto("/settings");
    await expect(header.getByText("api", { exact: true })).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    await page.route("**/api/backend/health", (route) =>
      route.fulfill({
        status: 504,
        json: {
          statusCode: 504,
          error: "Gateway Timeout",
          message: "The API did not respond in time.",
          path: "/api/backend/health",
          timestamp: new Date().toISOString(),
        },
      }),
    );
    const readsBefore = healthReads.length;

    await expect(async () => {
      await page.clock.runFor(30_000);
      expect(healthReads.length - readsBefore).toBeGreaterThan(0);
    }).toPass({ timeout: 10_000 });
    await expect(async () => {
      await page.clock.runFor(20);
      await expect(
        header.getByText("unreachable", { exact: true }),
      ).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 10_000 });

    expect(healthReads.length - readsBefore).toBe(1);
  });

  for (const [status, error, message] of GATEWAY_ANSWERS) {
    test(`reads unreachable when the proxy answers ${status} on a later poll`, async ({
      page,
    }) => {
      const header = page.getByRole("banner");
      await page.clock.install();
      await seedSession(page);
      await page.goto("/settings");
      await expect(header.getByText("api", { exact: true })).toBeVisible();

      await page.route("**/api/backend/health", (route) =>
        route.fulfill({
          status,
          json: {
            statusCode: status,
            error,
            message,
            path: "/api/backend/health",
            timestamp: new Date().toISOString(),
          },
        }),
      );
      await pollUntilShown(page, "unreachable");

      await expect(header.getByText("degraded", { exact: true })).toHaveCount(
        0,
      );
      await expect(header.locator("svg.lucide-circle-x")).toHaveCount(1);
      await expect(header.locator("svg.lucide-triangle-alert")).toHaveCount(0);
    });
  }

  for (const [status, body, detail, label] of [
    [
      502,
      {
        statusCode: 502,
        error: "Bad Gateway",
        message: "The API is unreachable.",
        path: "/api/backend/health",
        timestamp: new Date().toISOString(),
      },
      "API unreachable",
      "unreachable",
    ],
    [
      503,
      databaseDownAnswer("/api/backend/health"),
      "API up · database unavailable",
      "degraded",
    ],
  ] as const) {
    test(`the tooltip of a first poll answered ${status} reads ${detail}`, async ({
      page,
    }) => {
      await page.route("**/api/backend/health", (route) =>
        route.fulfill({ status, json: body }),
      );
      await seedSession(page);
      await page.goto("/settings");

      const badge = page.getByRole("banner").getByText(label, { exact: true });
      await expect(badge).toBeVisible({ timeout: 20_000 });
      await hoverForTooltip(page, badge, page.getByRole("tooltip"));
      await expect(page.getByRole("tooltip")).toHaveText(detail);
    });
  }

  test("reads degraded when the api answers its own 503 and recovers", async ({
    page,
    context,
  }) => {
    const header = page.getByRole("banner");
    const answers: {
      status: number;
      retryAfter: string | null;
      db?: string;
    }[] = [];
    page.on("response", async (response) => {
      if (!response.url().includes("/api/backend/health")) return;
      const body: { db?: string } = response.ok() ? {} : await response.json();
      answers.push({
        status: response.status(),
        retryAfter: response.headers()["retry-after"] ?? null,
        db: body.db,
      });
    });
    await page.clock.install();
    await seedSession(page);
    await page.goto("/settings");
    await expect(header.getByText("api", { exact: true })).toBeVisible();

    await context.addCookies([
      { name: "e2e_health", value: "database", domain: "localhost", path: "/" },
    ]);
    await pollUntilShown(page, "degraded");
    await expect(header.locator("svg.lucide-triangle-alert")).toHaveCount(1);
    expect(answers).toContainEqual({
      status: 503,
      retryAfter: "5",
      db: "down",
    });

    await context.clearCookies({ name: "e2e_health" });
    await pollUntilShown(page, "api");
  });

  for (const [outage, status] of [
    ["refused", 502],
    ["silent", 504],
  ] as const) {
    test(`reads unreachable when the real proxy answers ${status} for a ${outage} api`, async ({
      page,
      context,
    }) => {
      test.setTimeout(90_000);
      const header = page.getByRole("banner");
      const proxyAnswers: number[] = [];
      page.on("response", (response) => {
        if (response.url().includes("/api/backend/health")) {
          proxyAnswers.push(response.status());
        }
      });
      await page.clock.install();
      await seedSession(page);
      await page.goto("/settings");
      await expect(header.getByText("api", { exact: true })).toBeVisible();

      await context.addCookies([
        { name: "e2e_health", value: outage, domain: "localhost", path: "/" },
      ]);
      await pollUntilShown(page, "unreachable", 60_000);

      expect(proxyAnswers).toContain(status);
      await context.clearCookies({ name: "e2e_health" });
      await pollUntilShown(page, "api", 60_000);
    });
  }
});

test.describe("instance capacity", () => {
  test("the operator sees capacity in settings and on the dashboard", async ({
    page,
    context,
  }) => {
    await seedSession(page);
    await context.addCookies([
      { name: "e2e_budget_hot", value: "1", domain: "localhost", path: "/" },
    ]);

    await page.goto("/settings");
    await expect(page.getByRole("region", { name: "Capacity" })).toBeVisible();

    await page.goto("/");
    await expect(page.getByText(/of the daily request budget/)).toBeVisible();
    await expect(
      page.getByText(/exceed 85% of your store rate limit/),
    ).toBeVisible();
  });

  for (const viewer of ["customer", "member"] as const) {
    test(`a ${viewer} sees no instance capacity anywhere`, async ({
      page,
      context,
    }) => {
      await seedSession(page);
      await seedViewer(context, viewer);
      await context.addCookies([
        { name: "e2e_budget_hot", value: "1", domain: "localhost", path: "/" },
      ]);

      await page.goto("/settings");
      await expect(page.getByRole("region", { name: "Alerts" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Capacity" })).toHaveCount(
        0,
      );
      await expect(page.getByText("Daily request budget")).toHaveCount(0);

      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "Account menu" }),
      ).toBeVisible();
      await expect(page.getByText(/of the daily request budget/)).toHaveCount(
        0,
      );
      await expect(
        page.getByText(/exceed 85% of your store rate limit/),
      ).toHaveCount(0);
    });
  }
});
