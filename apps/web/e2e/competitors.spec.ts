import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const matrix = (page: Page) =>
  page.getByRole("table", { name: /compared with each tracked competitor/ });

const matrixRows = (page: Page) => matrix(page).getByRole("row");

test("the comparison matrix sorts by your position both ways", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors");
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
  const rows = matrixRows(page);

  await page.getByRole("combobox", { name: "Filter by result" }).click();
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

test("a matrix filter that matches nothing offers to clear it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/competitors?vs=tied");

  await expect(page.getByText("No keywords match these filters")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/vs=/);
  await expect(matrixRows(page)).toHaveCount(5);
});

test("matrix positions and scores carry their grade", async ({ page }) => {
  await page.goto("/apps/app-1/competitors");
  const focus = matrix(page).getByRole("row", { name: /focus timer/ });
  const pomodoro = matrix(page).getByRole("row", { name: /pomodoro/ });
  const productivity = matrix(page).getByRole("row", {
    name: /productivity app/,
  });

  await expect(focus.getByTitle("Position 3, strong")).toHaveAttribute(
    "data-grade",
    "strong",
  );
  await expect(focus.getByTitle("Position 9, fair")).toHaveAttribute(
    "data-grade",
    "fair",
  );
  await expect(pomodoro.getByTitle("Position 12, weak")).toHaveAttribute(
    "data-grade",
    "weak",
  );

  const unranked = productivity.getByTitle("Not ranking");
  await expect(unranked).toHaveCount(1);
  await expect(unranked).not.toHaveAttribute("data-grade", /.+/);

  const keywordCell = focus.getByRole("cell").first();
  await expect(
    keywordCell.getByLabel("Popularity 100, strong"),
  ).toHaveAttribute("data-grade", "strong");
  await expect(keywordCell.getByLabel("Difficulty 40, fair")).toHaveAttribute(
    "data-grade",
    "fair",
  );
});
