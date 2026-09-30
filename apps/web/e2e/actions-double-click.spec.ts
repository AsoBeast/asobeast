import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const card = (id: string) => `[id='action-${id}']`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/actions`, {
    failOnStatusCode: true,
  });
});

const countUpdates = (page: Page, id: string) => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith(`/api/backend/actions/${id}`)
    ) {
      seen.push(request.url());
    }
  });
  return seen;
};

const toast = (page: Page, text: string) =>
  page.getByRole("region", { name: /^Notifications/ }).getByText(text);

const hydrated = async (control: Locator): Promise<Locator> => {
  await expect
    .poll(() =>
      control.evaluate((element) =>
        Object.keys(element).some((key) => key.startsWith("__reactProps")),
      ),
    )
    .toBe(true);
  return control;
};

const activateTwiceInOneTask = async (control: Locator) =>
  (await hydrated(control)).evaluate((element: HTMLElement) => {
    element.click();
    element.click();
  });

test("a double click on Done sends one update and shows one confirmation", async ({
  page,
}) => {
  const updates = countUpdates(page, "act-audit");
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
  const updates = countUpdates(page, "act-dismissed");
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
  const updates = countUpdates(page, "act-audit");
  await page.goto("/actions?action=act-audit");

  await activateTwiceInOneTask(
    page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }),
  );

  await expect(toast(page, "Marked done")).toBeVisible();
  expect(updates).toHaveLength(1);
});

test("two activations of Undo send one undo", async ({ page }) => {
  const updates = countUpdates(page, "act-audit");
  await page.goto("/actions");
  await (
    await hydrated(
      page.locator(card("act-audit")).getByRole("button", { name: "Done" }),
    )
  ).click();
  await expect(toast(page, "Marked done")).toBeVisible();

  await activateTwiceInOneTask(page.getByRole("button", { name: "Undo" }));

  await expect(page.locator(card("act-audit"))).toBeVisible();
  expect(updates).toHaveLength(2);
});
