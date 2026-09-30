import type { Locator, Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const card = (id: string) => `[id='action-${id}']`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/actions`, {
    failOnStatusCode: true,
  });
});

const countUpdates = (page: Page, path: string) => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith(`/api/backend${path}`)
    ) {
      seen.push(request.url());
    }
  });
  return seen;
};

const toast = (page: Page, text: string) =>
  page.getByRole("region", { name: /^Notifications/ }).getByText(text);

const activateTwiceInOneTask = async (control: Locator) =>
  (await hydrated(control)).evaluate((element: HTMLElement) => {
    element.click();
    element.click();
  });

test("a double click on Done sends one update and shows one confirmation", async ({
  page,
}) => {
  const updates = countUpdates(page, "/actions/act-audit");
  await page.goto("/actions");

  await (
    await hydrated(
      page.locator(card("act-audit")).getByRole("button", { name: "Done" }),
    )
  ).dblclick();

  await expect(toast(page, "Marked done")).toBeVisible();
  expect(updates).toHaveLength(1);
});

test("two activations of Reopen in one task send one update", async ({
  page,
}) => {
  const updates = countUpdates(page, "/actions/act-dismissed");
  await page.goto("/actions?status=DISMISSED");

  await activateTwiceInOneTask(
    page.locator(card("act-dismissed")).getByRole("button", { name: "Reopen" }),
  );

  await expect(toast(page, "Action reopened")).toBeVisible();
  expect(updates).toHaveLength(1);
});

test("two activations of Done in the detail sheet send one update", async ({
  page,
}) => {
  const updates = countUpdates(page, "/actions/act-audit");
  await page.goto("/actions?action=act-audit");

  await activateTwiceInOneTask(
    page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }),
  );

  await expect(toast(page, "Marked done")).toBeVisible();
  expect(updates).toHaveLength(1);
});

test("two activations of Undo send one undo", async ({ page }) => {
  const updates = countUpdates(page, "/actions/act-audit");
  await page.goto("/actions");
  await (
    await hydrated(
      page.locator(card("act-audit")).getByRole("button", { name: "Done" }),
    )
  ).click();
  await expect(toast(page, "Marked done")).toBeVisible();

  const undone = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith("/api/backend/actions/act-audit"),
  );
  await activateTwiceInOneTask(
    page
      .getByRole("region", { name: /^Notifications/ })
      .getByRole("button", { name: "Undo" }),
  );
  await undone;

  await expect(page.locator(card("act-audit"))).toBeVisible();
  expect(updates).toHaveLength(2);
});

test("two activations of a bulk Undo send one undo", async ({ page }) => {
  const updates = countUpdates(page, "/actions");
  await page.goto("/actions");
  for (const id of ["act-prune", "act-volatile"]) {
    await (
      await hydrated(page.locator(card(id)).getByRole("checkbox"))
    ).click();
  }
  await page
    .getByRole("toolbar", { name: "Bulk actions" })
    .getByRole("button", { name: "Done" })
    .click();
  await expect(toast(page, "Marked 2 done")).toBeVisible();

  const undone = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith("/api/backend/actions"),
  );
  await activateTwiceInOneTask(
    page
      .getByRole("region", { name: /^Notifications/ })
      .getByRole("button", { name: "Undo" }),
  );
  await undone;

  await expect(page.locator(card("act-prune"))).toBeVisible();
  expect(updates).toHaveLength(2);
});
