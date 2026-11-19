import { ANA_LONG_FAILURE, SUSPEND_REASON } from "./admin-fixtures.mts";
import { errorEnvelope } from "./fixtures.mts";
import { fulfillJson } from "./plan-helpers.mts";
import { expect, test } from "./session.mts";

const ANA_DETAIL = "**/api/backend/admin/support/workspaces/ws_ana";

test.describe("workspace details", () => {
  test("the name opens the details and Back closes them", async ({ page }) => {
    await page.goto("/admin/workspaces");
    await page.getByRole("button", { name: "Ana Apps", exact: true }).click();

    const sheet = page.getByRole("dialog", { name: "Ana Apps" });
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/[?&]workspace=ws_ana(&|$)/);

    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Ana Apps", exact: true }),
    ).toBeFocused();
  });

  test("closing returns focus to the name", async ({ page }) => {
    await page.goto("/admin/workspaces");
    await page.getByRole("button", { name: "Ana Apps", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Ana Apps" })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(
      page.getByRole("button", { name: "Ana Apps", exact: true }),
    ).toBeFocused();
    await expect(page).not.toHaveURL(/workspace=/);
  });

  test("a link opens the details straight away", async ({ page }) => {
    await page.goto("/admin/workspaces?workspace=ws_lapsed");

    const sheet = page.getByRole("dialog", { name: "Lapsed Studio" });
    await expect(sheet.getByText("ws_lapsed", { exact: true })).toBeVisible();
    await expect(sheet.getByText("Suspended since")).toBeVisible();
    await expect(sheet.getByText("Sustained rate limit abuse")).toBeVisible();
  });

  test("shows usage against the limits in force", async ({ page }) => {
    await page.goto("/admin/workspaces?workspace=ws_ana");

    const sheet = page.getByRole("dialog", { name: "Ana Apps" });
    const limits = sheet.getByRole("table", { name: "Limits and usage" });
    await expect(limits.getByRole("row", { name: /^Apps/ })).toContainText(
      "2 of 5",
    );
    await expect(
      limits.getByRole("row", { name: /^Keyword markets/ }),
    ).toContainText("40 of 1,000");
    await expect(
      sheet
        .getByRole("table", { name: "On demand allowances" })
        .getByRole("row", { name: /^Refresh/ }),
    ).toContainText("50 a day");
  });

  test("an unknown workspace says so and offers to close", async ({ page }) => {
    await page.goto("/admin/workspaces?workspace=ws_gone");

    const sheet = page.getByRole("dialog", { name: "Workspace" });
    await expect(
      sheet.getByText("This workspace no longer exists."),
    ).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).first().click();

    await expect(sheet).toHaveCount(0);
    await expect(page).not.toHaveURL(/workspace=/);
  });

  test("a failed read can be tried again and is never retried by itself", async ({
    page,
  }) => {
    let calls = 0;
    await page.route(ANA_DETAIL, (route) => {
      calls += 1;
      return calls === 1
        ? route.fulfill(
            fulfillJson(500, errorEnvelope(500, "/admin/support/workspaces")),
          )
        : route.fallback();
    });
    await page.goto("/admin/workspaces?workspace=ws_ana");

    const failed = page.getByRole("dialog", { name: "Workspace" });
    await expect(
      failed.getByText("Could not read this workspace."),
    ).toBeVisible();
    expect(calls).toBe(1);
    await failed.getByRole("button", { name: "Retry" }).click();

    const sheet = page.getByRole("dialog", { name: "Ana Apps" });
    await expect(
      sheet
        .getByRole("table", { name: "Limits and usage" })
        .getByRole("row", { name: /^Apps/ }),
    ).toBeVisible();
    expect(calls).toBe(2);
  });

  test("reopening within a minute reads the details again from the cache", async ({
    page,
  }) => {
    let calls = 0;
    await page.route(ANA_DETAIL, (route) => {
      calls += 1;
      return route.fallback();
    });
    await page.goto("/admin/workspaces");
    const name = page.getByRole("button", { name: "Ana Apps", exact: true });
    const sheet = page.getByRole("dialog", { name: "Ana Apps" });

    await name.click();
    await expect(
      sheet.getByRole("table", { name: "Limits and usage" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await name.click();
    await expect(
      sheet.getByRole("table", { name: "Limits and usage" }),
    ).toBeVisible();

    expect(calls).toBe(1);
  });

  test("closing the details keeps the list's filters", async ({ page }) => {
    await page.goto("/admin/workspaces?stage=trialing&workspace=ws_card_trial");
    await expect(
      page.getByRole("dialog", { name: "Northwind Labs" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/stage=trialing/);
    await expect(page).not.toHaveURL(/workspace=/);
    await expect(
      page.getByRole("button", { name: "Northwind Labs", exact: true }),
    ).toBeFocused();
  });

  test("a link to a workspace the search hides hands focus to the search on close", async ({
    page,
  }) => {
    await page.goto("/admin/workspaces?workspace=ws_ana&q=northwind");
    await expect(page.getByRole("dialog", { name: "Ana Apps" })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(
      page.getByRole("textbox", { name: "Search workspaces" }),
    ).toBeFocused();
    await expect(page).toHaveURL(/q=northwind/);
  });

  test("closing a sheet a link opened stays on the page", async ({ page }) => {
    await page.goto("/admin/workspaces");
    await page.goto("/admin/workspaces?workspace=ws_ana");
    await expect(page.getByRole("dialog", { name: "Ana Apps" })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/\/admin\/workspaces$/);
    await expect(
      page.getByRole("button", { name: "Ana Apps", exact: true }),
    ).toBeFocused();
  });

  test("an id the address cannot hold opens nothing", async ({ page }) => {
    await page.goto("/admin/workspaces?workspace=all");

    await expect(
      page.getByRole("table", { name: "Workspaces on this instance" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("what a workspace ran and who looked", () => {
  test("lists every day of keyword checks the API answers and invents none", async ({
    page,
  }) => {
    await page.goto("/admin/workspaces?workspace=ws_ana");

    const checks = page
      .getByRole("dialog", { name: "Ana Apps" })
      .getByRole("table", { name: "Keyword checks" });
    await expect(checks.getByRole("row")).toHaveCount(9);
    await expect(checks.getByRole("row").nth(3)).toContainText("6");
  });

  test("says when a workspace has no checks and no failed jobs", async ({
    page,
  }) => {
    await page.goto("/admin/workspaces?workspace=ws_card_trial");

    const sheet = page.getByRole("dialog", { name: "Northwind Labs" });
    await expect(
      sheet.getByText("No keyword checks in the last 7 days."),
    ).toBeVisible();
    await expect(sheet.getByText("No failed store jobs.")).toBeVisible();
    await expect(
      sheet.getByRole("table", { name: "Keyword checks" }),
    ).toHaveCount(0);
  });

  test("lists failed jobs newest first with their store and reason", async ({
    page,
  }) => {
    await page.goto("/admin/workspaces?workspace=ws_ana");

    const jobs = page
      .getByRole("dialog", { name: "Ana Apps" })
      .getByRole("list", { name: "Failed store jobs" })
      .getByRole("listitem");
    await expect(jobs).toHaveCount(2);
    await expect(jobs.first()).toContainText("check-keyword");
    await expect(jobs.first()).toContainText("App Store");
    await expect(jobs.first()).toContainText("3 attempts");
    await expect(jobs.first()).toContainText(ANA_LONG_FAILURE);
    await expect(jobs.nth(1)).toContainText("Google Play");
    await expect(jobs.nth(1)).toContainText("1 attempt");
    await expect(jobs.nth(1)).toContainText("Time not recorded");
  });

  test("lists the access log with who, what, why and the result", async ({
    page,
  }) => {
    await page.goto("/admin/workspaces?workspace=ws_ana");

    const log = page
      .getByRole("dialog", { name: "Ana Apps" })
      .getByRole("list", { name: "Access log" });
    const entries = log.getByRole("listitem");
    await expect(entries).toHaveCount(5);
    await expect(entries.first()).toContainText("Viewed");
    await expect(entries.first()).toContainText("In progress");
    await expect(entries.nth(1)).toContainText("Suspended");
    await expect(entries.nth(1)).toContainText(SUSPEND_REASON);
    await expect(entries.nth(3)).toContainText("Started a daily run");
    await expect(entries.nth(3)).toContainText("Failed");
    await expect(entries.nth(3)).toContainText("Redis is unreachable");
    await expect(log).toContainText("owner@example.com");
  });
});
