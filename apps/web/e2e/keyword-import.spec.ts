import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, Request } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_IMPORT_ID, BUDGET } from "./fixtures.mts";
import { hydrated } from "./hydrated.mts";
import { seedViewer } from "./viewer.mts";

test.describe.configure({ mode: "serial" });

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const KEYWORDS = `/apps/${APP_IMPORT_ID}/keywords`;

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API_URL}/__reset/keywords/${APP_IMPORT_ID}`, {
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

const TWO_APP_FILE = [
  "App Name,App Id,Platform,Keyword,Country,Note",
  "Import Lab,123456789,iphone,alpha one,us,",
  "Import Lab,123456789,ipad,alpha one,us,",
  "Import Lab,123456789,iphone,beta two,pl,Launch keyword",
  "Other App,987654321,iphone,gamma three,us,",
].join("\r\n");

const ASTRO_FILE = [
  "App Name,App Id,Platform,Keyword,Store Domain,Store,Note,Last Update,Ranking,Change,Popularity,Difficulty,Apps in Ranking,Tags",
  "Import Lab,123456789,iphone,alpha one,us,🇺🇸 US,,2026-10-29 22:23:37 +0000,4,2,48,31,120,",
  "Import Lab,123456789,ipad,alpha one,us,🇺🇸 US,,2026-10-29 22:23:37 +0000,6,0,48,31,120,",
  'Import Lab,123456789,iphone,beta two,pl,🇵🇱 Poland,"Launch keyword",2026-10-29 22:23:53 +0000,2,-1,22,18,64,"core, brand"',
  "Other App,987654321,iphone,gamma three,us,🇺🇸 US,,2026-10-29 22:23:37 +0000,9,1,60,40,200,focus",
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

test("P-WEB-01 keeps both import buttons inside a phone screen without squeezing the heading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(KEYWORDS);

  const heading = await page
    .getByRole("heading", { name: "Tracked keywords" })
    .boundingBox();
  expect(heading?.height).toBeLessThan(36);

  for (const name of ["Import CSV", "Add keywords"]) {
    const box = await page.getByRole("button", { name }).first().boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(375);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
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
  expect(
    sent.filter((request) => request.url().includes("/preview")),
  ).toHaveLength(1);
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

test("P-WEB-05 names every column picker by its visible label", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(dialog, "keyword,country\r\ndeep work,us\r\n");

  for (const field of ["Keyword", "Country", "Tags", "Note"]) {
    const picker = dialog.getByRole("combobox", { name: `${field} column` });
    const id = await picker.getAttribute("id");
    expect(id).toBeTruthy();
    await expect(
      dialog.locator("label", { hasText: new RegExp(`^${field}$`) }),
    ).toHaveAttribute("for", id ?? "");
  }
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

test("P-WEB-07 imports a file longer than one import in parts, one after the other", async ({
  page,
}) => {
  const sent = importRequests(page);
  const dialog = await openDialog(page);
  const rows = Array.from({ length: 501 }, (_, index) => `phrase ${index}`);

  await choose(dialog, ["keyword", ...rows].join("\r\n"));

  await expect(
    dialog.getByText(
      "The 501 rows are imported in 2 parts, one after the other. Part 1 holds lines 2 to 501.",
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("500 new");
  const first = dialog.getByRole("button", { name: "Import 500 keywords" });
  await first.focus();
  await page.keyboard.press("Enter");

  await expect(
    page.getByText("Part 1 of 2 is in. Review part 2 and import it next."),
  ).toBeVisible();
  await expect(
    dialog.getByText("Part 2 holds lines 502 to 502."),
  ).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("1 new");
  const second = dialog.getByRole("button", { name: "Import 1 keyword" });
  await expect(second).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(dialog).toBeHidden();
  const imports = sent.filter((request) => !request.url().includes("/preview"));
  expect(imports.map((request) => request.postDataJSON().rows.length)).toEqual([
    500, 1,
  ]);
});

test("P-WEB-07 starts again from the first part when the columns change", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  const rows = Array.from({ length: 501 }, (_, index) => `phrase ${index}`);
  await choose(
    dialog,
    ["keyword,note", ...rows.map((row) => `${row},`)].join("\r\n"),
  );
  await dialog.getByRole("button", { name: "Import 500 keywords" }).click();
  await expect(
    dialog.getByText("Part 2 holds lines 502 to 502."),
  ).toBeVisible();

  await dialog.getByRole("combobox", { name: "Note column" }).click();
  await page.getByRole("option", { name: "Not in the file" }).click();

  await expect(dialog.getByText("Part 1 holds lines 2 to 501.")).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("500 already tracked");
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

test("P-WEB-08 shows the keyword markets used and a way to a larger plan when rows are over the limit", async ({
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

  const notice = dialog
    .getByRole("note")
    .filter({ hasText: "keyword markets used" });
  await expect(notice).toContainText(
    /\d+ of 5 keyword markets used\. 2 rows are over your plan's keyword limit and are skipped\./,
  );
  await expect(notice.getByRole("link", { name: "See plans" })).toHaveAttribute(
    "href",
    "/upgrade",
  );
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

test("P-WEB-10 marks the review busy without fading its text", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(dialog, "keyword\r\nalpha one\r\n");
  await expect(dialog.getByRole("status")).toHaveText("1 new");
  const held = Promise.withResolvers<void>();
  await page.route("**/keywords/import/preview", async (route) => {
    await held.promise;
    await route.continue();
  });

  await dialog
    .getByRole("combobox", { name: "Market for rows without a country" })
    .click();
  await page.getByRole("option", { name: /PL/ }).click();

  const review = dialog.getByRole("region", { name: "Review" });
  await expect(review).toHaveAttribute("aria-busy", "true");
  await expect(review.getByText("Updating")).toBeVisible();
  expect(await review.evaluate((node) => getComputedStyle(node).opacity)).toBe(
    "1",
  );
  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withRules(["color-contrast"])
    .analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);

  held.resolve();
  await expect(review).toHaveAttribute("aria-busy", "false");
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

test("P-WEB-13 says when the chosen file cannot be read", async ({ page }) => {
  const sent = importRequests(page);
  const dialog = await openDialog(page);
  await page.evaluate(() => {
    File.prototype.arrayBuffer = () =>
      Promise.reject(
        new DOMException("The file could not be read", "NotReadableError"),
      );
  });

  await choose(dialog, "keyword\r\nalpha one\r\n");

  await expect(dialog.getByRole("alert")).toContainText(
    "That file could not be read.",
  );
  expect(sent).toEqual([]);
});

test("P-WEB-13 keeps the file chosen last when an earlier one finishes reading later", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    const held = Promise.withResolvers<void>();
    Object.assign(window, { releaseLargeFile: held.resolve });
    File.prototype.arrayBuffer = function (this: File) {
      return this.name === "large.csv"
        ? held.promise.then(() => read.call(this))
        : read.call(this);
    };
  });

  await choose(dialog, "keyword\r\nlarge one\r\n", "large.csv");
  await choose(dialog, "keyword\r\nsmall one\r\n", "small.csv");
  await expect(rowOf(dialog, /small one/)).toBeVisible();

  await page.evaluate(async () => {
    (window as unknown as { releaseLargeFile: () => void }).releaseLargeFile();
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  await expect(dialog.getByText(/Reading large\.csv/)).toHaveCount(0);
  await expect(dialog.getByText(/Reading small\.csv/)).toBeVisible();
  await expect(rowOf(dialog, /small one/)).toBeVisible();
});

test("P-WEB-14 says when the market the dialog starts on is not a storefront", async ({
  page,
}) => {
  const sent = importRequests(page);
  const dialog = await openDialog(page, `${KEYWORDS}?country=zz`);

  await choose(dialog, "keyword\r\nalpha one\r\n");

  await expect(dialog.getByRole("alert")).toContainText(
    "zz is not an App Store storefront. Choose the market for rows without a country.",
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

const budgetNear = async (page: Page, total: number) => {
  await page.route("**/api/backend/jobs/budget", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...BUDGET,
        stores: BUDGET.stores.map((entry) =>
          entry.store === "APP_STORE"
            ? { ...entry, total, capacityPerDay: 21_600 }
            : entry,
        ),
      }),
    }),
  );
};

test("P-WEB-15 tells the operator what the import does to the daily capacity", async ({
  page,
}) => {
  await budgetNear(page, 21_550);
  const dialog = await openDialog(page);

  await choose(
    dialog,
    [
      "keyword",
      ...Array.from({ length: 100 }, (_, index) => `phrase ${index}`),
    ].join("\r\n"),
  );

  await expect(dialog.getByRole("note")).toContainText(
    "Adds about 100 store requests a day, taking App Store to 100% of its daily capacity",
  );
});

test("P-WEB-15 tells a customer the requests added and not the instance capacity", async ({
  page,
  context,
}) => {
  await seedViewer(context, "customer");
  await budgetNear(page, 21_550);
  const dialog = await openDialog(page);

  await choose(dialog, ["keyword", "alpha one", "beta two"].join("\r\n"));

  await expect(
    dialog
      .getByRole("note")
      .filter({ hasText: "Adds about 2 store requests a day." }),
  ).toBeVisible();
  await expect(dialog.getByText("daily capacity")).toHaveCount(0);
});

test("P-WEB-16 says so when the review cannot reach the server", async ({
  page,
}) => {
  await page.route("**/keywords/import/preview", (route) => route.abort());
  const dialog = await openDialog(page);

  await choose(dialog, "keyword\r\nalpha one\r\n");

  await expect(dialog.getByRole("alert")).toContainText(
    "Could not reach the api to review this file",
  );
  await expect(
    dialog.getByRole("button", { name: "Nothing to import" }),
  ).toBeDisabled();
});

test("P-WEB-17 imports only the app it is on from a file that holds several apps", async ({
  page,
}) => {
  const dialog = await openDialog(page);

  await choose(dialog, TWO_APP_FILE, "two-apps.csv");

  const picker = dialog.getByRole("combobox", { name: "App to import" });
  await expect(picker).toContainText("Import Lab (3 rows)");
  await expect(
    dialog.getByText("1 row for other apps is left out."),
  ).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("2 new, 1 duplicate");
  await expect(rowOf(dialog, /beta two/).getByText("PL")).toBeVisible();
  await expect(rowOf(dialog, /gamma three/)).toHaveCount(0);

  await picker.click();
  await page.getByRole("option", { name: /All apps/ }).click();

  await expect(dialog.getByText(/holds rows for 2 apps/)).toHaveCount(0);
  await expect(dialog.getByRole("status")).toHaveText("3 new, 1 duplicate");
  await expect(rowOf(dialog, /gamma three/)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Import 3 keywords" }),
  ).toBeEnabled();
});

test("P-WEB-17 waits for an app to be chosen when no app of the file is the one it is on", async ({
  page,
}) => {
  const dialog = await openDialog(page);

  await choose(
    dialog,
    TWO_APP_FILE.replaceAll("Import Lab,123456789", "Third App,555000999"),
    "two-other-apps.csv",
  );

  const picker = dialog.getByRole("combobox", { name: "App to import" });
  await expect(picker).toContainText("Choose an app");
  await expect(
    dialog.getByText(
      "This file holds rows for 2 apps. Choose one under App to import, or All apps, before you import.",
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("3 new, 1 duplicate");
  await expect(
    dialog.getByRole("button", { name: "Import 3 keywords" }),
  ).toBeDisabled();

  await picker.click();
  await page.getByRole("option", { name: "Other App (1 row)" }).click();

  await expect(dialog.getByRole("status")).toHaveText("1 new");
  await expect(
    dialog.getByText("3 rows for other apps are left out."),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Import 1 keyword" }),
  ).toBeEnabled();
});

test("P-WEB-17 has no accessibility violations with the app picker shown", async ({
  page,
}) => {
  const dialog = await openDialog(page);
  await choose(dialog, TWO_APP_FILE, "two-apps.csv");
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

test("P-WEB-18 reads an Astro export as it is", async ({ page }) => {
  const dialog = await openDialog(page);

  await choose(dialog, ASTRO_FILE, "astro-keywords.csv");

  await expect(
    dialog.getByRole("combobox", { name: "Country column" }),
  ).toContainText("Store Domain");
  await expect(
    dialog.getByRole("combobox", { name: "App to import" }),
  ).toContainText("Import Lab");
  await expect(
    dialog.getByText("1 row for other apps is left out."),
  ).toBeVisible();
  await expect(dialog.getByText("7 other columns are ignored.")).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("2 new, 1 duplicate");
  await expect(rowOf(dialog, /beta two/).getByText("PL")).toBeVisible();
  await expect(
    rowOf(dialog, /alpha one/)
      .first()
      .getByText("US"),
  ).toBeVisible();
});

test("P-WEB-19 reads an AppFollow export from its header row", async ({
  page,
}) => {
  const dialog = await openDialog(page);

  await choose(
    dialog,
    [
      "sep=,",
      'App name "Import Lab"',
      "To: 2026-10-29,Page: tracked,ItemId: 261827,From: 2026-10-29,Dt_start: 2026-10-23,Dt_last: 2026-10-29,Device: iphone,Country: us,Compare: 2026-10-23,App_id: 50703",
      "",
      '"Sort by: Device, Keyword"',
      "",
      "Keyword,Position,Changes,Best Rank,Keywords in Title,Keywords in Subtitle,Total Apps,Popularity,Search Downloads,% of Search Downloads,2026-10-23,2026-10-24,2026-10-25,2026-10-26,2026-10-27,2026-10-28,2026-10-29",
      "alpha one,4,,3,1,0,120,48,Upgrade plan to see this data,Upgrade plan to see this data,-,-,-,-,-,-,4",
      "beta two,,,,0,0,80,31,Upgrade plan to see this data,Upgrade plan to see this data,-,-,-,-,-,-,-",
    ].join("\n"),
    "keywords_iphone_1793312083.csv",
  );

  await expect(
    dialog.getByText("4 rows above the header were skipped."),
  ).toBeVisible();
  await expect(dialog.getByText("16 other columns are ignored.")).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("2 new");
  await expect(rowOf(dialog, /alpha one/).getByText("8")).toBeVisible();
});
