import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, Request } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_IMPORT_ID } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const KEYWORDS = `/apps/${APP_IMPORT_ID}/keywords`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/keywords`, {
    failOnStatusCode: true,
  });
});

async function openDialog(page: Page, path = KEYWORDS): Promise<Locator> {
  await page.goto(path);
  const trigger = page.getByRole("button", { name: "Import CSV" }).first();
  await (await hydrated(trigger)).click();
  const dialog = page.getByRole("dialog", { name: "Import keywords from CSV" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function choose(
  dialog: Locator,
  content: string | Buffer,
  name = "keywords.csv",
): Promise<void> {
  await dialog.getByLabel("Keyword file").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: typeof content === "string" ? Buffer.from(content) : content,
  });
}

const rowOf = (dialog: Locator | Page, text: RegExp | string) =>
  dialog.getByRole("row", { name: text });

const FILE = [
  "keyword,country,tags,note",
  "focus timer,us,,",
  "time blocking,us,,",
  "Deep Work,us,core; brand,Launch keyword",
  "deep-work,,,",
  "zegar pracy,pl,core,",
  "tower,zz,,",
].join("\r\n");

const importRequests = (page: Page) => {
  const seen: Request[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /\/keywords\/import/.test(request.url())
    ) {
      seen.push(request);
    }
  });
  return seen;
};

test("P-WEB-01 offers the import beside Add keywords and in the empty state", async ({
  page,
}) => {
  await page.goto(KEYWORDS);
  await expect(
    page.getByRole("button", { name: "Import CSV" }).first(),
  ).toBeVisible();

  await page.goto("/apps/app-2/keywords");
  await expect(
    page.getByRole("button", { name: "Import CSV" }).first(),
  ).toBeVisible();
});

test("P-WEB-02 downloads a template the import reads back", async ({
  page,
}) => {
  const dialog = await openDialog(page);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Download template" }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("keyword-import-template.csv");
  const [header, first] = readFileSync(await download.path(), "utf8")
    .replace(/^\uFEFF/, "")
    .split("\r\n");
  expect(header).toBe("keyword,country,tags,note");
  expect(first).toContain("habit tracker");
});

test("P-WEB-03 reviews every row, then imports the new and paused ones with their tags", async ({
  page,
}) => {
  const sent = importRequests(page);
  const dialog = await openDialog(page);

  await choose(dialog, FILE);

  await expect(dialog.getByRole("status")).toHaveText(
    "2 new, 1 resume, 1 already tracked, 1 duplicate, 1 invalid",
  );
  await expect(
    rowOf(dialog, /focus timer/).getByText("Already tracked", { exact: true }),
  ).toBeVisible();
  await expect(
    rowOf(dialog, /time blocking/).getByText("Resume", { exact: true }),
  ).toBeVisible();
  await expect(
    rowOf(dialog, /deep work/)
      .first()
      .getByText("New", { exact: true }),
  ).toBeVisible();
  await expect(
    rowOf(dialog, /deep work/)
      .nth(1)
      .getByText("Repeats line 4"),
  ).toBeVisible();
  await expect(
    rowOf(dialog, /tower/).getByText("zz is not an App Store storefront"),
  ).toBeVisible();
  expect(sent.map((request) => request.url().includes("/preview"))).toEqual([
    true,
  ]);

  const imported = page.waitForRequest(
    (request) =>
      request.method() === "POST" && /\/keywords\/import$/.test(request.url()),
  );
  await dialog.getByRole("button", { name: "Import 3 keywords" }).click();

  expect((await imported).postDataJSON()).toEqual({
    country: "us",
    rows: [
      { keyword: "focus timer", country: "us" },
      { keyword: "time blocking", country: "us" },
      {
        keyword: "Deep Work",
        country: "us",
        tags: ["core", "brand"],
        note: "Launch keyword",
      },
      { keyword: "deep-work" },
      { keyword: "zegar pracy", country: "pl", tags: ["core"] },
      { keyword: "tower", country: "zz" },
    ],
  });
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Tracking 3 keywords")).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "deep work Note: Launch keyword" }),
  ).toBeVisible();
  await expect(
    rowOf(page, /deep work/).getByRole("group", { name: "Tags: core, brand" }),
  ).toBeVisible();
});

test("P-WEB-04 says when a file has no header and what it ignores", async ({
  page,
}) => {
  const dialog = await openDialog(page);

  await choose(dialog, "Deep Work\r\nzegar pracy\r\n");
  await expect(
    dialog.getByText(
      "No header row was found, so column 1 is read as the keyword.",
    ),
  ).toBeVisible();

  await choose(dialog, "deep work,us,core\r\nzegar pracy,pl,brand\r\n");
  await expect(dialog.getByText("2 other columns are ignored.")).toBeVisible();
  await expect(
    dialog.getByRole("switch", { name: "First row is a header" }),
  ).not.toBeChecked();
});

test("P-WEB-05 lets the person correct the header and the keyword column", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(
    dialog,
    "Query Term,Where\r\ndeep work,us\r\nzegar pracy,pl\r\n",
  );
  await expect(rowOf(dialog, /query term/i)).toBeVisible();

  await dialog.getByRole("switch", { name: "First row is a header" }).click();
  await dialog.getByRole("combobox", { name: "Keyword column" }).click();
  await page.getByRole("option", { name: /Where/ }).click();

  await expect(rowOf(dialog, /query term/i)).toHaveCount(0);
  await expect(
    dialog.getByRole("cell", { name: "us", exact: true }).first(),
  ).toBeVisible();
});

test("P-WEB-06 reads a semicolon file saved as UTF-16 and a Windows code page file with a notice", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from(
      "Keyword;Market;Tags\r\nżółw;pl;core\r\nzegar pracy;pl;\r\n",
      "utf16le",
    ),
  ]);

  await choose(dialog, utf16, "excel-unicode.txt");

  await expect(rowOf(dialog, /żółw/)).toBeVisible();
  await expect(rowOf(dialog, /zegar pracy/).getByText("PL")).toBeVisible();
  await expect(dialog.getByText(/read as Windows-1252/)).toHaveCount(0);

  await choose(
    dialog,
    Buffer.from([
      0x6b, 0x65, 0x79, 0x77, 0x6f, 0x72, 0x64, 0x0d, 0x0a, 0x63, 0x61, 0x66,
      0xe9, 0x0d, 0x0a,
    ]),
    "ansi.csv",
  );

  await expect(dialog.getByText(/read as Windows-1252/)).toBeVisible();
  await expect(rowOf(dialog, /café/)).toBeVisible();
});

test("P-WEB-07 refuses more rows than one import may carry before sending anything", async ({
  page,
}) => {
  const sent = importRequests(page);
  const dialog = await openDialog(page);
  const rows = Array.from({ length: 501 }, (_, index) => `phrase ${index}`);

  await choose(dialog, ["keyword", ...rows].join("\r\n"));

  await expect(dialog.getByRole("alert")).toContainText(
    "The file has 501 rows. One import takes up to 500 rows",
  );
  await expect(
    dialog.getByRole("button", { name: "Nothing to import" }),
  ).toBeDisabled();
  expect(sent).toEqual([]);
});

test("P-WEB-08 filters the review by status and counts the rows shown", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "e2e_keyword_quota", value: "5", domain: "localhost", path: "/" },
  ]);
  const dialog = await openDialog(page);

  await choose(
    dialog,
    ["keyword", "alpha one", "beta two", "gamma three"].join("\r\n"),
  );
  await expect(dialog.getByText("Over limit").first()).toBeVisible();

  await dialog.getByRole("button", { name: "Filter by status" }).click();
  await page.getByRole("option", { name: /^Over limit/ }).click();
  await dialog
    .getByRole("heading", { name: "Import keywords from CSV" })
    .click();

  await expect(dialog.getByText("2 of 3 rows")).toBeVisible();
  await expect(rowOf(dialog, /alpha one/)).toHaveCount(0);
});

test("P-WEB-08 keeps the status and the reason of a very long phrase in view", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(dialog, `keyword\r\n${"b".repeat(101)}\r\nok phrase\r\n`);
  await expect(dialog.getByRole("status")).toHaveText("1 new, 1 invalid");

  const region = dialog.getByRole("region", { name: "Rows of the file" });
  const reason = rowOf(dialog, /bbbb/).getByText(
    "Keyword exceeds 100 characters",
  );
  const [box, shown] = await Promise.all([
    region.boundingBox(),
    reason.boundingBox(),
  ]);

  expect(shown && box && shown.x + shown.width).toBeLessThanOrEqual(
    (box?.x ?? 0) + (box?.width ?? 0),
  );
});

test("P-WEB-09 sends the import once however often the button is pressed", async ({
  page,
}) => {
  await page.route(
    `**/api/backend/apps/${APP_IMPORT_ID}/keywords/import`,
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    },
  );
  const sent = importRequests(page);
  const dialog = await openDialog(page);
  await choose(dialog, "keyword\r\nalpha one\r\n");
  const button = dialog.getByRole("button", { name: "Import 1 keyword" });
  await expect(button).toBeEnabled();

  await button.dblclick();

  await expect(
    dialog.getByRole("button", { name: "Importing…" }),
  ).toBeDisabled();
  await expect(dialog).toBeHidden();
  expect(
    sent.filter((request) => !request.url().includes("/preview")),
  ).toHaveLength(1);
});

test("P-WEB-10 has no accessibility violations with the review open", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(dialog, FILE);
  await expect(dialog.getByRole("status")).toBeVisible();
  await dialog.evaluate((node) =>
    Promise.all(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    ).then(() => undefined),
  );

  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();

  expect(
    violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
});

test("P-WEB-10 lets a keyboard scroll a review longer than its box", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(
    dialog,
    [
      "keyword",
      ...Array.from({ length: 40 }, (_, index) => `phrase ${index}`),
    ].join("\r\n"),
  );
  await expect(dialog.getByRole("status")).toHaveText("40 new");

  const rows = dialog.getByRole("region", { name: "Rows of the file" });
  await rows.focus();
  await page.keyboard.press("End");

  await expect(rows).toBeFocused();
  await expect
    .poll(() => rows.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
});

test("P-WEB-11 closes on Escape, returns focus to the button and forgets the file", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(dialog, FILE);

  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Import CSV" }).first(),
  ).toBeFocused();
  await page.getByRole("button", { name: "Import CSV" }).first().click();
  await expect(page.getByRole("dialog").getByLabel("Keyword file")).toHaveValue(
    "",
  );
  await expect(page.getByRole("dialog").getByRole("status")).toHaveCount(0);
});

test("P-WEB-12 keeps the dialog open and says why when the keyword slots were taken first", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "e2e_import_race", value: "1", domain: "localhost", path: "/" },
  ]);
  const dialog = await openDialog(page);
  await choose(dialog, "keyword\r\nalpha one\r\n");

  await dialog.getByRole("button", { name: "Import 1 keyword" }).click();

  await expect(dialog.getByRole("alert")).toContainText(
    "Your plan's keyword limit was reached by another change. Nothing was imported.",
  );
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Tracking 1 keyword")).toHaveCount(0);
});

test("P-WEB-13 refuses a file too large to be a keyword list without reading it", async ({
  page,
}) => {
  const sent = importRequests(page);
  const dialog = await openDialog(page);

  await choose(dialog, Buffer.alloc(2_000_001, "a"), "huge.csv");

  await expect(dialog.getByRole("alert")).toContainText(
    "too large to be a keyword list",
  );
  expect(sent).toEqual([]);
});

test("P-WEB-14 gives a row without a country the market chosen in the dialog", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(dialog, "keyword\r\nalpha one\r\n");
  await expect(rowOf(dialog, /alpha one/).getByText("US")).toBeVisible();

  const preview = page.waitForRequest(
    (request) =>
      /\/import\/preview$/.test(request.url()) &&
      request.postDataJSON().country === "pl",
  );
  await dialog
    .getByRole("combobox", { name: "Market for rows without a country" })
    .click();
  await page.getByRole("option", { name: /PL/ }).click();

  await preview;
  await expect(rowOf(dialog, /alpha one/).getByText("PL")).toBeVisible();
});
