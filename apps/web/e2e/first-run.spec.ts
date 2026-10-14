import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  APP_1_DETAIL,
  FIRST_RUN_MID,
  FIRST_RUN_UNSCHEDULED,
} from "./fixtures.mts";

const MID_RUN_APP = FIRST_RUN_MID.appId;

test("a mid run app names what is still finishing", async ({ page }) => {
  await page.goto(`/apps/${MID_RUN_APP}`);

  const panel = page.getByRole("list", { name: /still finishing/i });
  await expect(panel).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "3 steps are still finishing." }),
  ).toBeVisible();

  const scores = panel.getByRole("listitem").filter({
    hasText: "Popularity and difficulty scored",
  });
  await expect(scores).toContainText("1 of 8");
  await expect(scores).toContainText("weekly run");
});

test("a mid run app lists its first positions", async ({ page }) => {
  await page.goto(`/apps/${MID_RUN_APP}`);

  const positions = page.getByRole("list", { name: "First positions" });
  await expect(
    page.getByText("Your app ranks #2 for “focus timer”."),
  ).toBeVisible();
  await expect(positions.getByRole("listitem")).toHaveText([
    "“focus timer” · #2",
    "“pomodoro” · #15",
    "“study timer” · #40",
    "“deep work timer” · not in the top 200",
  ]);
  await expect(page.getByText("break timer")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "See every position" }),
  ).toHaveAttribute("href", `/apps/${MID_RUN_APP}/rankings`);
});

test("first positions that fail to load offer a retry", async ({ page }) => {
  let failing = true;
  await page.route(
    `**/api/backend/apps/${MID_RUN_APP}/keywords?country=us`,
    (route) =>
      failing
        ? route.fulfill({ status: 500, json: { statusCode: 500 } })
        : route.fallback(),
  );
  await page.goto(`/apps/${MID_RUN_APP}`);

  const section = page.getByRole("region", { name: "First positions" });
  await expect(section.getByRole("alert")).toHaveText(
    "Could not load the first positions.",
    { timeout: 15_000 },
  );

  failing = false;
  await section.getByRole("button", { name: "Retry" }).click();

  await expect(
    section.getByText("Your app ranks #2 for “focus timer”."),
  ).toBeVisible();
});

test("a fully collected app renders no panel at all", async ({ page }) => {
  await page.goto(`/apps/${APP_1_DETAIL.id}`);

  await expect(page.getByText(/steps are still finishing/i)).toHaveCount(0);
  await expect(page.getByText(/step is still finishing/i)).toHaveCount(0);
  await expect(page.getByText("Positions collected")).toHaveCount(0);
  await expect(page.getByText("First positions")).toHaveCount(0);
});

test("an unreadable schedule is reported as queued rather than as a date", async ({
  page,
}) => {
  await page.goto(`/apps/${FIRST_RUN_UNSCHEDULED.appId}`);

  const rankings = page
    .getByRole("list", { name: /still finishing/i })
    .getByRole("listitem")
    .filter({ hasText: "Positions collected" });

  await expect(rankings).toContainText("queued rather than scheduled");
  await expect(rankings).not.toContainText(/\d{4}/);
});

test("the timeline is a real list every stage is announced from", async ({
  page,
}) => {
  await page.goto(`/apps/${MID_RUN_APP}`);

  const panel = page.getByRole("list", { name: /still finishing/i });
  await expect(panel.getByRole("listitem")).toHaveCount(6);
  await expect(panel.getByRole("listitem").first()).toContainText(
    "Listing captured",
  );
  await expect(panel.getByRole("listitem").last()).toContainText(
    "Daily history",
  );
});

test.describe("the alerts nudge", () => {
  const NUDGE = "Get told when a position moves";
  const setCookies = (page: Page, cookies: Record<string, string>) =>
    page.context().addCookies(
      Object.entries(cookies).map(([name, value]) => ({
        name,
        value,
        url: "http://localhost:3000",
      })),
    );

  test("shows after two captures without a channel and opens the email dialog", async ({
    page,
  }) => {
    await setCookies(page, { "e2e-empty-alerts": "1", e2e_history_days: "2" });
    await page.goto(`/apps/${APP_1_DETAIL.id}`);

    await expect(page.getByText(NUDGE)).toBeVisible();
    await page.getByRole("button", { name: "Add an email alert" }).click();

    await expect(
      page.getByRole("dialog", { name: "Add email alert" }),
    ).toBeVisible();
  });

  test("a closed email dialog opens again without the earlier input", async ({
    page,
  }) => {
    await setCookies(page, { "e2e-empty-alerts": "1", e2e_history_days: "2" });
    await page.goto(`/apps/${APP_1_DETAIL.id}`);

    await page.getByRole("button", { name: "Add an email alert" }).click();
    const dialog = page.getByRole("dialog", { name: "Add email alert" });
    await dialog.getByLabel("Recipient email").fill("alerts@example");
    await dialog.getByRole("button", { name: "Add email alert" }).click();
    await expect(dialog.getByText("Enter a valid email address")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Add an email alert" }).click();
    await expect(dialog.getByLabel("Recipient email")).toHaveValue("");
    await expect(dialog.getByText("Enter a valid email address")).toHaveCount(
      0,
    );
  });

  test("offers a webhook when the instance cannot send email", async ({
    page,
  }) => {
    await setCookies(page, {
      "e2e-empty-alerts": "1",
      e2e_history_days: "2",
      e2e_smtp_off: "1",
    });
    await page.goto(`/apps/${APP_1_DETAIL.id}`);

    await expect(
      page.getByText("Email alerts need SMTP on this instance."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add a webhook" }).click();

    await expect(
      page.getByRole("dialog", { name: "Add webhook" }),
    ).toBeVisible();
  });

  test("stays hidden with one capture", async ({ page }) => {
    await setCookies(page, { "e2e-empty-alerts": "1", e2e_history_days: "1" });
    await page.goto(`/apps/${APP_1_DETAIL.id}`);

    await page.waitForLoadState("networkidle");
    await expect(page.getByText(NUDGE)).toHaveCount(0);
  });

  test("stays hidden while the first positions are collected", async ({
    page,
  }) => {
    await setCookies(page, { "e2e-empty-alerts": "1" });
    await page.goto(`/apps/${MID_RUN_APP}`);

    await expect(
      page.getByRole("list", { name: /still finishing/i }),
    ).toBeVisible();
    await expect(page.getByText(NUDGE)).toHaveCount(0);
  });

  test("stays hidden once a channel exists", async ({ page }) => {
    await setCookies(page, { e2e_history_days: "2" });
    await page.goto(`/apps/${APP_1_DETAIL.id}`);

    await page.waitForLoadState("networkidle");
    await expect(page.getByText(NUDGE)).toHaveCount(0);
  });

  test("hides after not now and stays hidden on reload", async ({ page }) => {
    await setCookies(page, { "e2e-empty-alerts": "1", e2e_history_days: "2" });
    await page.goto(`/apps/${APP_1_DETAIL.id}`);

    await page.getByRole("button", { name: "Not now" }).click();
    await expect(page.getByText(NUDGE)).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(NUDGE)).toHaveCount(0);
  });
});
