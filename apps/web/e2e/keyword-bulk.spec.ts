import type { Page } from "@playwright/test";
import { APP_BULK_BAR_ID, APP_BULK_KEYWORDS } from "./fixtures.mts";
import { expect, test } from "./session.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const BAR = `/apps/${APP_BULK_BAR_ID}/keywords`;
const BULK = /\/api\/backend\/apps\/[^/]+\/keywords\/bulk$/;
const ROW = /\/api\/backend\/apps\/[^/]+\/keywords\/[^/]+$/;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/keywords/${APP_BULK_BAR_ID}`, {
    failOnStatusCode: true,
  });
});

const bar = (page: Page) =>
  page.getByRole("group", { name: "Bulk keyword actions" });

function recordRequests(page: Page) {
  const bulk: { action: string; keywordIds: string[] }[] = [];
  const rows: string[] = [];
  page.on("request", (request) => {
    if (BULK.test(request.url()) && request.method() === "POST") {
      bulk.push(request.postDataJSON());
    } else if (
      ROW.test(request.url()) &&
      ["PATCH", "DELETE"].includes(request.method())
    ) {
      rows.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  return { bulk, rows };
}

test("pausing three keywords is one request and no row request", async ({
  page,
}) => {
  const sent = recordRequests(page);
  await page.goto(BAR);
  await page.getByRole("checkbox", { name: "Select all keywords" }).check();

  await bar(page).getByRole("button", { name: "Pause" }).click();

  await expect(page.getByText("Paused 3 keywords")).toBeVisible();
  expect(sent.bulk).toEqual([
    { action: "pause", keywordIds: ["kw-1", "kw-2", "kw-3"] },
  ]);
  expect(sent.rows).toEqual([]);
  await expect(page.getByText("Paused", { exact: true })).toHaveCount(3);
});

test("a selection of every keyword of a large app is one request", async ({
  page,
}) => {
  const sent = recordRequests(page);
  await page.route(BULK, (route) => {
    const { action, keywordIds } = route.request().postDataJSON() as {
      action: string;
      keywordIds: string[];
    };
    return route.fulfill({
      json: {
        action,
        requested: keywordIds.length,
        changed: keywordIds.length,
        unchanged: 0,
        missing: [],
      },
    });
  });
  await page.goto("/apps/app-bulk/keywords");
  await page.waitForLoadState("networkidle");
  await page.getByRole("checkbox", { name: "Select all keywords" }).check();

  await bar(page).getByRole("button", { name: "Pause" }).click();

  await expect(
    page.getByText(`Paused ${APP_BULK_KEYWORDS.length} keywords`),
  ).toBeVisible();
  expect(sent.bulk).toHaveLength(Math.ceil(APP_BULK_KEYWORDS.length / 500));
  expect(sent.bulk[0].keywordIds).toHaveLength(
    Math.min(APP_BULK_KEYWORDS.length, 500),
  );
  expect(sent.rows).toEqual([]);
});

test("activating names the keywords that were already active", async ({
  page,
  request,
}) => {
  await request.post(`${MOCK_API_URL}/apps/${APP_BULK_BAR_ID}/keywords/bulk`, {
    data: { action: "pause", keywordIds: ["kw-1"] },
    failOnStatusCode: true,
  });
  await page.goto(BAR);
  await page.getByRole("checkbox", { name: "Select all keywords" }).check();

  await bar(page).getByRole("button", { name: "Activate" }).click();

  await expect(
    page.getByText("Activated 1 keyword, 2 already active"),
  ).toBeVisible();
});

test("removing sends one untrack request after the confirmation", async ({
  page,
}) => {
  const sent = recordRequests(page);
  await page.goto(BAR);
  await page.getByRole("checkbox", { name: "Select all keywords" }).check();

  await bar(page).getByRole("button", { name: "Remove", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Stop tracking" })
    .click();

  await expect(page.getByText("Stopped tracking 3 keywords")).toBeVisible();
  expect(sent.bulk).toEqual([
    { action: "untrack", keywordIds: ["kw-1", "kw-2", "kw-3"] },
  ]);
  expect(sent.rows).toEqual([]);
});

test.describe("when the request fails", () => {
  test("a refused activation keeps the selection and says why", async ({
    page,
    context,
    request,
  }) => {
    await request.post(
      `${MOCK_API_URL}/apps/${APP_BULK_BAR_ID}/keywords/bulk`,
      {
        data: { action: "pause", keywordIds: ["kw-1", "kw-2", "kw-3"] },
        failOnStatusCode: true,
      },
    );
    await context.addCookies([
      {
        name: "e2e-bulk-over-quota",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto(BAR);
    await page.getByRole("checkbox", { name: "Select all keywords" }).check();

    await bar(page).getByRole("button", { name: "Activate" }).click();

    await expect(page.getByText("Could not activate 3 keywords")).toBeVisible();
    await expect(page.getByText(/Keyword markets limit reached/)).toBeVisible();
    await expect(bar(page)).toContainText("3 selected");
  });

  test("a server error keeps the removal dialog open and the selection", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "e2e-fail-keyword-bulk",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto(BAR);
    await page.getByRole("checkbox", { name: "Select all keywords" }).check();

    await bar(page)
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Stop tracking" })
      .click();

    await expect(
      page.getByText("Could not stop tracking 3 keywords"),
    ).toBeVisible();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(bar(page)).toContainText("3 selected");
  });
});
