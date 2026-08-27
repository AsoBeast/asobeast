import { expect, test } from "./session.mts";
import {
  EMAIL_ALERTS,
  HEALTH_DEGRADED,
  RUN_STATUS_DELAYED,
  PORTFOLIO,
  WEBHOOKS,
} from "./fixtures.mts";
import { hoverForTooltip } from "./hover.mts";

test("web liveness is independent from the api", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({
    status: "ok",
    statusPageUrl: null,
    errorReportingDsn: null,
  });
});

test("home renders the portfolio grid with totals and per-app cards", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Apps", level: 1 }),
  ).toBeVisible();

  const [first, second] = PORTFOLIO.apps;
  await expect(
    page.getByRole("link", { name: first.name ?? "", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: second.name ?? "", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByText(`${first.trackedKeywords} keywords`),
  ).toBeVisible();

  await expect(
    page.getByText(first.country.toUpperCase(), { exact: true }).first(),
  ).toBeVisible();

  await expect(page.getByText("Changes this week")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "visibility, last 30 days" }).first(),
  ).toBeVisible();
});

test("recent changes feed renders fixture events on the dashboard", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("Across your portfolio")).toBeVisible();
  await expect(page.getByText("Focus Timer Pro")).toBeVisible();
});

test("settings exposes the weekly digest event", async ({ page }) => {
  await page.goto("/settings");

  await expect(
    page.getByText("Daily request budget", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add webhook" }).first().click();
  await expect(
    page.getByRole("checkbox", { name: "Weekly digest" }),
  ).toBeVisible();
});

test("settings lists email alerts and expands their delivery log", async ({
  page,
}) => {
  await page.goto("/settings");

  const [alert] = EMAIL_ALERTS;
  await expect(page.getByText(alert.email, { exact: true })).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Add email alert" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Recent deliveries" }).last().click();

  await expect(page.getByText("Failed").first()).toBeVisible();
  await expect(page.getByText("Success").first()).toBeVisible();
});

test("settings shows the delivery card and flushes on demand", async ({
  page,
}) => {
  let statusRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/backend/alerts/delivery")) {
      statusRequests += 1;
    }
  });
  await page.goto("/settings");

  await expect(page.getByText("Delivery", { exact: true })).toBeVisible();
  await expect(page.getByText("Batched", { exact: true })).toBeVisible();
  await expect(
    page.getByText("After completion", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0 3 * * *", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Daily events are sent after processing as an app update, followed by a competitor watch when each has activity.",
    ),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Claimed" })
      .getByText("1", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Flush now" }).click();

  await expect(
    page.getByText("Sent 4 notifications to 2 channels from 7 events"),
  ).toBeVisible();
  await expect.poll(() => statusRequests).toBe(1);
});

test("delivery status handles instant, never-flushed and claimed states on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.context().addCookies([
    {
      name: "delivery_status",
      value: "instant",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Instant", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Each event is delivered instantly, one notification per event.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Never", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("group", { name: "Claimed" })
      .getByText("2", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("manual flush toast handles zero, singular and scoped notification counts", async ({
  page,
}) => {
  const results = [
    { flushed: 0, channels: 0, notifications: 0 },
    { flushed: 1, channels: 1, notifications: 1 },
    { flushed: 7, channels: 1, notifications: 2 },
  ];
  let index = 0;
  await page.route("**/api/backend/alerts/flush", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results[index++]),
    }),
  );
  await page.goto("/settings");
  const button = page.getByRole("button", { name: "Flush now" });

  for (const message of [
    "Nothing to flush",
    "Sent 1 notification to 1 channel from 1 event",
    "Sent 2 notifications to 1 channel from 7 events",
  ]) {
    await button.click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  }
});

test("manual flush disables while pending and surfaces mutation errors", async ({
  page,
}) => {
  const { promise: requestGate, resolve: release } =
    Promise.withResolvers<void>();
  await page.route("**/api/backend/alerts/flush", async (route) => {
    await requestGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ flushed: 1, channels: 1, notifications: 1 }),
    });
  });
  await page.goto("/settings");
  const button = page.getByRole("button", { name: "Flush now" });

  await button.click();
  await expect(button).toBeDisabled();
  release();
  await expect(
    page.getByText("Sent 1 notification to 1 channel from 1 event"),
  ).toBeVisible();

  await page.unroute("**/api/backend/alerts/flush");
  await page.route("**/api/backend/alerts/flush", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "failed" }),
    }),
  );
  await button.click();
  await expect(page.getByText("Could not flush alerts")).toBeVisible();
});

test("health badge reflects the mocked health endpoint", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("api", { exact: true })).toHaveCount(1);
  const badge = page.getByRole("banner").getByText("api", { exact: true });
  await expect(badge).toBeVisible();
  await hoverForTooltip(
    page,
    badge,
    page.getByText("API healthy · database up"),
  );
});

test("shell chrome remains accessible across widths and themes", async ({
  page,
}) => {
  for (const width of [1280, 375]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/");

      const root = page.locator("html");
      if (colorScheme === "dark") await expect(root).toHaveClass(/dark/);
      else await expect(root).not.toHaveClass(/dark/);

      await expect(page.getByText("api", { exact: true })).toHaveCount(1);

      const documentation = page.getByRole("link", { name: "Documentation" });
      if (!(await documentation.isVisible())) {
        await page.keyboard.press("ControlOrMeta+b");
      }
      await expect(documentation).toBeVisible();
      await documentation.focus();
      await expect(documentation).toBeFocused();
      await expect(documentation).not.toHaveCSS("box-shadow", "none");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("settings stays reachable at every width", async ({ page }) => {
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    const header = page.getByRole("link", { name: "Settings" });
    if (await header.isVisible()) {
      await expect(header).toHaveAttribute("href", "/settings");
      continue;
    }

    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Settings" }),
    ).toHaveAttribute("href", "/settings");
    await page.keyboard.press("Escape");
  }
});

test("health badge surfaces a degraded pipeline", async ({ page }) => {
  await page.route("**/api/backend/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(HEALTH_DEGRADED),
    }),
  );

  await page.goto("/");

  const badge = page.getByRole("banner").getByText("degraded", { exact: true });
  await expect(badge).toBeVisible();
  await hoverForTooltip(
    page,
    badge,
    page.getByText(/3 failed jobs — check \/admin\/queues/),
  );
});

test("alert channels fit a narrow viewport without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/settings");

  const [webhook] = WEBHOOKS;
  await expect(
    page.getByText(webhook.url, { exact: true }).first(),
  ).toBeVisible();

  const scrollers = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main *")]
      .filter(
        (node) =>
          ["auto", "scroll"].includes(getComputedStyle(node).overflowX) &&
          node.scrollWidth > node.clientWidth,
      )
      .map((node) => node.className.slice(0, 80)),
  );

  expect(scrollers).toEqual([]);
});

test("a delayed run is named for the store that is behind", async ({
  page,
}) => {
  await page.route("**/api/backend/jobs/run-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(RUN_STATUS_DELAYED),
    }),
  );

  await page.goto("/");

  const notice = page.getByRole("alert").filter({ hasText: "are delayed" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    "Rankings for your Google Play apps are delayed",
  );
  await expect(notice).toContainText("50 of 100");
});

test("no delay notice appears while the run is on time", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("are delayed")).toHaveCount(0);
});
