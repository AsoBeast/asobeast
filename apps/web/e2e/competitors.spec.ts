import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { hydrated } from "./hydrated.mts";

const matrix = (page: Page) =>
  page.getByRole("table", { name: /compared with each tracked competitor/ });

const matrixRows = (page: Page) => matrix(page).getByRole("row");

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
  await expect(rows.nth(3)).toContainText("time blocking");
  await expect(rows.nth(4)).toContainText("productivity app");

  await you.click();

  await expect(page).toHaveURL(/dir=desc/);
  await expect(rows.nth(1)).toContainText("time blocking");
  await expect(rows.nth(3)).toContainText("focus timer");
  await expect(rows.nth(4)).toContainText("productivity app");
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
  await expect(rows.nth(4)).toContainText("time blocking");

  await page.getByRole("button", { name: "Difficulty", exact: true }).click();
  await expect(page).toHaveURL(/sort=difficulty/);
  await expect(rows.nth(1)).toContainText("pomodoro");
  await expect(rows.nth(4)).toContainText("time blocking");
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
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText("pomodoro");
  await expect(rows.nth(2)).toContainText("productivity app");
  await expect(page.getByText("2 of 4 keywords")).toBeVisible();

  await page.getByRole("textbox", { name: "Search keywords" }).fill("pomo");

  await expect(page).toHaveURL(/q=pomo/);
  await expect(rows).toHaveCount(2);
  await expect(page.getByText("Result: Losing")).toBeVisible();
  await expect(page.getByText("Search: pomo")).toBeVisible();

  await page.getByRole("button", { name: "Clear all" }).click();

  await expect(page).not.toHaveURL(/vs=|q=/);
  await expect(rows).toHaveCount(5);
});

test("the comparison matrix shows each keyword's market and filters by it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  const rows = matrixRows(page);

  await expect(matrix(page).getByRole("columnheader").first()).toContainText(
    "Market",
  );
  await expect(
    matrix(page)
      .getByRole("row", { name: /time blocking/ })
      .getByRole("cell")
      .first(),
  ).toContainText("Germany");

  const market = page.getByRole("combobox", { name: "Filter by market" });
  await (await hydrated(market)).click();
  await page.getByRole("option", { name: /Germany/ }).click();

  await expect(page).toHaveURL(/country=de/);
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText("time blocking");
  await expect(page.getByText("1 of 4 keywords")).toBeVisible();
  await expect(page.getByText(/Market: .*Germany/)).toBeVisible();

  await page.getByRole("button", { name: /Remove Market/ }).click();

  await expect(page).not.toHaveURL(/country=/);
  await expect(rows).toHaveCount(5);
});

test("clicking a keyword opens why each app ranks for it", async ({ page }) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");

  const keyword = matrix(page).getByRole("button", {
    name: "Why apps rank for focus timer",
  });
  await (await hydrated(keyword)).click();

  await expect(page).toHaveURL(/keyword=kw-1/);
  const sheet = page.getByRole("dialog", {
    name: "Why apps rank for this keyword",
  });
  const you = sheet.getByRole("listitem", { name: "Focus Timer" });
  await expect(you).toContainText("You");
  await expect(you).toContainText("Exact phrase");
  await expect(you.locator("mark")).toHaveText(["Focus", "Timer", "timer"]);
  await expect(you).toContainText("Keyword field");
  await expect(you).toContainText("pomodoro, timer, planner");
  await expect(you).toContainText("2 of 2 keyword words in the listing");
  await expect(
    you.getByRole("note", { name: "Where you stand" }),
  ).toContainText("Your listing text changed 9 days ago.");

  const rival = sheet.getByRole("listitem", { name: "Rival Focus" });
  await expect(rival).toContainText("1 of 2 words");
  await expect(
    rival.getByRole("note", { name: "Why it may rank above you" }),
  ).toContainText(
    "No stronger placement than yours, but 48,000 ratings to your 1,200.",
  );
  await expect(rival.locator("mark").first()).toHaveText("Focus");
  const spanish = rival.getByRole("group", {
    name: "Spanish (Mexico) listing",
  });
  await expect(spanish).toContainText("Focus timer para estudiar");
  await expect(spanish).toContainText("Exact phrase");
  await expect(rival).toContainText("No match in its French listing.");
  await expect(rival).toContainText(
    "Not captured, so not checked: Korean and Vietnamese.",
  );
  await expect(rival).toContainText("Empty");
  await expect(rival).not.toContainText("Keyword field");
  await expect(rival).toContainText("4.2 rating from 310");

  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/keyword=/);
});

test("a matrix filter that matches nothing offers to clear it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors?vs=tied");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("No keywords match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/vs=/);
  await expect(matrixRows(page)).toHaveCount(5);
});

test("matrix positions and scores carry their grade", async ({ page }) => {
  await page.goto("/apps/app-1/competitors");
  await page.waitForLoadState("networkidle");
  const focus = matrix(page).getByRole("row", { name: /focus timer/ });
  const pomodoro = matrix(page).getByRole("row", { name: /pomodoro/ });
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
  await expect(focus.getByRole("cell").nth(1)).not.toContainText("Popularity");
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
    matrix(page)
      .getByRole("row", { name: /focus timer/ })
      .getByRole("cell")
      .first()
      .locator("[data-grade]", { hasText: "Popularity 100, strong" }),
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
    page.getByRole("button", { name: "Export competitors to CSV" }).click(),
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

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export comparison to CSV" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^keyword-comparison-app-1-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  expect(readFileSync(await download.path(), "utf8").split("\r\n")).toEqual([
    "\uFEFFkeyword,country,popularity,difficulty,you,Rival Focus,result,gap",
    "time blocking,de,,,45,>200,winning,false",
    "focus timer,us,100,40,3,9,winning,false",
  ]);
});

test("with only gaps on, the export is named for the gaps and holds them alone", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors?onlyGaps=true");
  await page.waitForLoadState("networkidle");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export comparison to CSV" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(
    /^keyword-gaps-app-1-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  expect(readFileSync(await download.path(), "utf8").split("\r\n")).toEqual([
    "\uFEFFkeyword,country,popularity,difficulty,you,Rival Focus,result,gap",
    "productivity app,us,100,60,>200,8,losing,true",
  ]);
});
