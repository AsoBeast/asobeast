import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { hydrated } from "./hydrated.mts";
import {
  CROWDED_COMPETITORS_COOKIE,
  UNCHECKED_COMPARISON_COOKIE,
} from "./fixtures.mts";

const matrix = (page: Page) =>
  page.getByRole("table", { name: /compared with each tracked competitor/ });

const matrixRows = (page: Page) => matrix(page).getByRole("row");

const keywordCell = (row: Locator) =>
  row.locator("td", { has: row.page().locator("[data-breakdown-keyword]") });

const comparisonExport = async (page: Page) => {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV of the comparison" }).click(),
  ]);
  return {
    filename: download.suggestedFilename(),
    lines: readFileSync(await download.path(), "utf8").split("\r\n"),
  };
};

const columnsButton = (page: Page) =>
  page.getByRole("button", { name: "Columns" }).last();

const marketHeader = (page: Page) =>
  matrix(page).getByRole("columnheader", { name: "Market", exact: true });

const germanRow = (page: Page) =>
  matrixRows(page).filter({ hasText: "Germany" }).first();

const crowdedMatrix = {
  name: CROWDED_COMPETITORS_COOKIE,
  value: "1",
  domain: "localhost",
  path: "/",
};

const uncheckedMatrix = {
  name: UNCHECKED_COMPARISON_COOKIE,
  value: "1",
  domain: "localhost",
  path: "/",
};

const pinnedLayout = (page: Page) =>
  matrix(page).evaluate((table) => {
    const box = table.closest<HTMLElement>("[data-slot=table-container]");
    if (box === null) throw new Error("the matrix has no scroll container");
    box.scrollLeft = box.scrollWidth;
    const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
    const pinned = heads.filter(
      (head) => getComputedStyle(head).position === "sticky",
    );
    const left = box.getBoundingClientRect().left;
    const pinnedRight = Math.max(
      left,
      ...pinned.map((head) => head.getBoundingClientRect().right),
    );
    const you = heads.find((head) => head.textContent?.trim() === "You");
    return {
      pinned: pinned.length,
      uncovered: box.getBoundingClientRect().right - pinnedRight,
      youWidth: you?.getBoundingClientRect().width ?? 0,
    };
  });

test("the comparison matrix sorts by your position both ways", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  const rows = matrixRows(page);
  await expect(rows.nth(1)).toContainText("focus timer");

  const you = page.getByRole("button", { name: "You", exact: true });
  await you.click();

  await expect(page).toHaveURL(/sort=you/);
  await expect(rows.nth(1)).toContainText("focus timer");
  await expect(rows.nth(2)).toContainText("pomodoro");
  await expect(rows.nth(3)).toContainText("pomodoro");
  await expect(rows.nth(4)).toContainText("time blocking");
  await expect(rows.nth(5)).toContainText("productivity app");

  await you.click();

  await expect(page).toHaveURL(/dir=desc/);
  await expect(rows.nth(1)).toContainText("time blocking");
  await expect(rows.nth(4)).toContainText("focus timer");
  await expect(rows.nth(5)).toContainText("productivity app");
  await expect(page.getByRole("columnheader", { name: "You" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
});

test("the comparison matrix sorts by a competitor and by popularity", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  const rows = matrixRows(page);

  await matrix(page)
    .getByRole("button", { name: "Rival Focus", exact: true })
    .click();
  await expect(page).toHaveURL(/sort=c%3Acomp-1|sort=c:comp-1/);
  await expect(rows.nth(1)).toContainText("pomodoro");
  await expect(rows.nth(5)).toContainText("time blocking");

  await page.getByRole("button", { name: "Difficulty", exact: true }).click();
  await expect(page).toHaveURL(/sort=difficulty/);
  await expect(rows.nth(1)).toContainText("pomodoro");
  await expect(rows.nth(5)).toContainText("time blocking");
});

test("the comparison matrix filters to losing rows and searches", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  const rows = matrixRows(page);

  const result = page.getByRole("combobox", { name: "Filter by result" });
  await (await hydrated(result)).click();
  await page.getByRole("option", { name: "Losing" }).click();

  await expect(page).toHaveURL(/vs=losing/);
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1)).toContainText("pomodoro");
  await expect(rows.nth(2)).toContainText("productivity app");
  await expect(rows.nth(3)).toContainText("pomodoro");
  await expect(page.getByText("3 of 5 keywords")).toBeVisible();

  await page.getByRole("textbox", { name: "Search keywords" }).fill("pomo");

  await expect(page).toHaveURL(/q=pomo/);
  await expect(rows).toHaveCount(3);
  await expect(page.getByText("Result: Losing")).toBeVisible();
  await expect(page.getByText("Search: pomo")).toBeVisible();

  await page.getByRole("button", { name: "Clear all" }).click();

  await expect(page).not.toHaveURL(/vs=|q=/);
  await expect(rows).toHaveCount(6);
});

for (const filter of ["vs=tied", "country=fr"]) {
  test(`a matrix filter that matches nothing offers to clear it (${filter})`, async ({
    page,
  }) => {
    await page.goto(`/apps/app-1/competitors?${filter}`);
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByText("No keywords match these filters"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/vs=|country=/);
    await expect(matrixRows(page)).toHaveCount(6);
  });
}

test("the matrix shows the market of every row when it spans markets", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  const header = matrix(page).getByRole("columnheader", {
    name: "Market",
    exact: true,
  });
  await expect(header).toBeVisible();
  expect(
    await header.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  const pomodoroRows = matrix(page).getByRole("row", { name: /pomodoro/ });
  await expect(pomodoroRows).toHaveCount(2);
  for (const [code, name] of [
    ["US", "United States"],
    ["DE", "Germany"],
  ]) {
    const market = pomodoroRows
      .filter({ hasText: name })
      .getByRole("cell")
      .first();
    await expect(market).toContainText(code);
    await expect(market.getByTitle(name)).toHaveCount(1);
    await expect(market).toHaveAccessibleName(name);
  }
});

test("the market filter keeps one market and clears with the others", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  const rows = matrixRows(page);

  const market = page.getByRole("combobox", { name: "Filter by market" });
  await (await hydrated(market)).click();
  await page.getByRole("option", { name: "Germany" }).click();

  await expect(page).toHaveURL(/country=de/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("pomodoro");
  await expect(rows.nth(1)).toContainText("Germany");
  await expect(page.getByText("Market: Germany")).toBeVisible();

  await page.getByRole("textbox", { name: "Search keywords" }).fill("pomo");
  await expect(page).toHaveURL(/q=pomo/);
  const result = page.getByRole("combobox", { name: "Filter by result" });
  await result.click();
  await page.getByRole("option", { name: "Losing" }).click();
  await expect(page).toHaveURL(/vs=losing/);
  await expect(rows).toHaveCount(2);

  const { lines } = await comparisonExport(page);
  expect(lines).toEqual([
    "\uFEFFkeyword,popularity,difficulty,you,Rival Focus,result,gap,country",
    "pomodoro,50,30,7,2,losing,false,de",
  ]);

  await page.getByRole("button", { name: "Clear all" }).click();

  await expect(page).not.toHaveURL(/country=|vs=|q=/);
  await expect(rows).toHaveCount(6);
});

test("a single market matrix shows no market column", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "e2e-comparison-market",
      value: "us",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  await expect(matrixRows(page)).toHaveCount(5);
  await expect(
    matrix(page).getByRole("columnheader", { name: "Market", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Filter by market" }),
  ).toHaveCount(0);
  await expect(page.getByText(/^Market:/)).toHaveCount(0);

  const { lines } = await comparisonExport(page);
  expect(lines[0]).toBe(
    "\uFEFFkeyword,popularity,difficulty,you,Rival Focus,result,gap,country",
  );
  expect(lines).toHaveLength(5);
  for (const line of lines.slice(1)) expect(line).toMatch(/,us$/);
});

test("a selected market no row is in stays on screen and clears", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-comparison-market",
      value: "us",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-1/competitors?country=de");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("No keywords match these filters")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Filter by market" }),
  ).toHaveText("Germany");
  await expect(page.getByText("Market: Germany")).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).click();

  await expect(page).not.toHaveURL(/country=/);
  await expect(matrixRows(page)).toHaveCount(5);
  await expect(
    matrix(page).getByRole("columnheader", { name: "Market", exact: true }),
  ).toHaveCount(0);
});

test("the only market selected filters nothing and shows no market chip", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-comparison-market",
      value: "us",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-1/competitors?country=us");
  await page.waitForLoadState("networkidle");

  await expect(matrixRows(page)).toHaveCount(5);
  await expect(page.getByText(/^Market:/)).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Filter by market" }),
  ).toHaveCount(0);
});

test("only gaps keeps the selected market when every gap is in another market", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors?country=de&onlyGaps=true");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("No keywords match these filters")).toBeVisible();
  await expect(page.getByText("Market: Germany")).toBeVisible();
  await expect(
    matrix(page).getByRole("row", { name: /productivity app/ }),
  ).toHaveCount(0);
});

test("the market column stays beside the keyword when the matrix scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  const container = matrix(page).locator(
    "xpath=ancestor::*[@data-slot='table-container']",
  );
  await container.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  await expect
    .poll(() => container.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);

  const left = (await container.boundingBox())?.x ?? 0;
  const firstRow = matrixRows(page).nth(1);
  const marketBox = await firstRow.getByRole("cell").first().boundingBox();
  const keywordBox = await keywordCell(firstRow).boundingBox();
  expect(marketBox?.x ?? -1).toBeGreaterThanOrEqual(left);
  expect(keywordBox?.x ?? -1).toBeGreaterThanOrEqual(
    (marketBox?.x ?? 0) + (marketBox?.width ?? 0) - 1,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(768);
});

test("matrix positions and scores carry their grade", async ({ page }) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  const focus = matrix(page).getByRole("row", { name: /focus timer/ });
  const pomodoro = matrix(page)
    .getByRole("row", { name: /pomodoro/ })
    .filter({ hasText: "United States" });
  const productivity = matrix(page).getByRole("row", {
    name: /productivity app/,
  });

  await expect(
    focus.locator("[data-grade]", { hasText: "Position 3, strong" }),
  ).toHaveAttribute("data-grade", "strong");
  await expect(
    focus.locator("[data-grade]", { hasText: "Position 9, fair" }),
  ).toHaveAttribute("data-grade", "fair");
  await expect(
    pomodoro.locator("[data-grade]", { hasText: "Position 12, weak" }),
  ).toHaveAttribute("data-grade", "weak");

  const unranked = productivity.getByTitle("Not ranking");
  await expect(unranked).toHaveCount(1);
  await expect(unranked).not.toHaveAttribute("data-grade", /.+/);

  const popularity = focus.locator("[data-grade]", {
    hasText: "Popularity 100, strong",
  });
  await expect(popularity).toHaveCount(1);
  await expect(popularity).toHaveAttribute("data-grade", "strong");
  const difficulty = focus.locator("[data-grade]", {
    hasText: "Difficulty 40, fair",
  });
  await expect(difficulty).toHaveCount(1);
  await expect(difficulty).toHaveAttribute("data-grade", "fair");
  await expect(keywordCell(focus)).not.toContainText("Popularity");
});

test("an app that was never checked reads as not checked, not as >200", async ({
  page,
  context,
}) => {
  await context.addCookies([uncheckedMatrix]);
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  const focus = matrix(page).getByRole("row", { name: /focus timer/ });
  const productivity = matrix(page).getByRole("row", {
    name: /productivity app/,
  });
  const blocking = matrix(page).getByRole("row", { name: /time blocking/ });

  await expect(focus.getByTitle("Not checked yet")).toHaveCount(1);
  await expect(focus.getByTitle("Not ranking")).toHaveCount(0);
  await expect(productivity.getByTitle("Not checked yet")).toHaveCount(1);
  await expect(blocking.getByTitle("Not checked yet")).toHaveCount(0);
  await expect(blocking.getByTitle("Not ranking")).toHaveCount(1);
});

test("the comparison export leaves a never checked position empty", async ({
  page,
  context,
}) => {
  await context.addCookies([uncheckedMatrix]);
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  const { lines } = await comparisonExport(page);

  expect(lines).toContain("focus timer,50,30,3,,winning,false,us");
  expect(lines).toContain("productivity app,50,30,,8,losing,true,us");
  expect(lines).toContain("time blocking,50,30,45,>200,winning,false,us");
});

test("on a phone the matrix names competitors by icon and hides the scores", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  const header = matrix(page).getByRole("columnheader", {
    name: "Rival Focus",
    exact: true,
  });
  await expect(header).toBeVisible();
  const box = await header.getByRole("button").boundingBox();
  expect(box?.width ?? 0).toBeLessThan(64);
  for (const name of ["Popularity", "Difficulty"]) {
    await expect(
      matrix(page).getByRole("columnheader", { name, exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    keywordCell(matrix(page).getByRole("row", { name: /focus timer/ })).locator(
      "[data-grade]",
      { hasText: "Popularity 100, strong" },
    ),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "Columns" }).last().click();
  await page.getByRole("menuitemcheckbox", { name: "Difficulty" }).click();
  await page.keyboard.press("Escape");
  await expect(
    matrix(page).getByRole("columnheader", { name: "Difficulty", exact: true }),
  ).toBeVisible();

  const discovery = page.getByRole("table", {
    name: /appearing in your keyword search results/,
  });
  for (const name of ["App", "Appearances", "Best", "Rating"]) {
    await expect(
      discovery.getByRole("columnheader", { name, exact: true }),
    ).toBeVisible();
  }
  for (const name of ["Keywords", "Avg"]) {
    await expect(
      discovery.getByRole("columnheader", { name, exact: true }),
    ).toHaveCount(0);
  }
});

for (const width of [320, 375] as const) {
  test(`on a phone at ${width} px the market sits in the keyword cell and the first position column stays readable`, async ({
    page,
    context,
  }) => {
    await context.addCookies([crowdedMatrix]);
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/apps/app-1/competitors");
    await page.waitForLoadState("networkidle");

    await expect(marketHeader(page)).toHaveCount(0);
    await expect(keywordCell(germanRow(page))).toContainText("Germany");
    const layout = await pinnedLayout(page);
    expect(layout.pinned).toBe(1);
    expect(layout.uncovered).toBeGreaterThanOrEqual(layout.youWidth);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test("the columns menu brings the market column back on a phone without pinning it", async ({
  page,
  context,
}) => {
  await context.addCookies([crowdedMatrix]);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  await (await hydrated(columnsButton(page))).click();
  await page.getByRole("menuitemcheckbox", { name: "Market" }).click();
  await page.keyboard.press("Escape");

  await expect(marketHeader(page)).toBeVisible();
  expect(
    await marketHeader(page).evaluate(
      (head) => getComputedStyle(head).position,
    ),
  ).toBe("static");
  await expect(keywordCell(germanRow(page))).not.toContainText("Germany");
  expect((await pinnedLayout(page)).pinned).toBe(1);
});

test("hiding the market column on a wide screen moves the market into the keyword cell and stays hidden", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  await expect(marketHeader(page)).toBeVisible();

  await (await hydrated(columnsButton(page))).click();
  await page.getByRole("menuitemcheckbox", { name: "Market" }).click();
  await page.keyboard.press("Escape");

  await expect(marketHeader(page)).toHaveCount(0);
  await expect(keywordCell(germanRow(page))).toContainText("Germany");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(marketHeader(page)).toHaveCount(0);
  await expect(keywordCell(germanRow(page))).toContainText("Germany");
});

test("a single market matrix does not offer a market column", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-comparison-market",
      value: "us",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  await (await hydrated(columnsButton(page))).click();

  await expect(
    page.getByRole("menuitemcheckbox", { name: "Difficulty" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Market" }),
  ).toHaveCount(0);
});

test("exporting competitors downloads one row per tracked competitor", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("1 tracked competitor", { exact: true }),
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV of competitors" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^competitors-app-1-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const lines = readFileSync(await download.path(), "utf8").split("\r\n");
  expect(lines[0]).toBe(
    "\uFEFFcompetitor,store,title,subtitle,summary,rating,ratings,installs,price,version,capturedAt",
  );
  expect(lines).toHaveLength(2);
  expect(lines[1]).toMatch(
    /^Rival Focus,APP_STORE,Rival Focus,Deep work timer,,4\.5,12000,,0,2\.1\.0,\d{4}-\d{2}-\d{2}T[\d:.]+Z$/,
  );
});

test("the comparison export writes the rows the matrix shows, in its order", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors?vs=winning&sort=you&dir=desc");
  await page.waitForLoadState("networkidle");

  const { filename, lines } = await comparisonExport(page);

  expect(filename).toMatch(/^keyword-comparison-app-1-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(lines).toEqual([
    "\uFEFFkeyword,popularity,difficulty,you,Rival Focus,result,gap,country",
    "time blocking,,,45,>200,winning,false,us",
    "focus timer,100,40,3,9,winning,false,us",
  ]);
});

test("with only gaps on, the export is named for the gaps and holds them alone", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors?onlyGaps=true");
  await page.waitForLoadState("networkidle");

  const { filename, lines } = await comparisonExport(page);

  expect(filename).toMatch(/^keyword-gaps-app-1-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(lines).toEqual([
    "\uFEFFkeyword,popularity,difficulty,you,Rival Focus,result,gap,country",
    "productivity app,100,60,>200,8,losing,true,us",
  ]);
});
