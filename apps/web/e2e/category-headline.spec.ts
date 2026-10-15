import { type Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  APP_1_DETAIL,
  APP_FREE_AGAIN_ID,
  APP_PAID_GROSSING_ONLY_ID,
  APP_PAID_TOP_CHART_ID,
  APP_PAID_UNRANKED_ID,
  APP_REPRICED_FREE_ID,
  APP_REPRICED_PAID_ID,
} from "./fixtures.mts";

const headline = async (page: Page, id: string) => {
  await page.goto(`/apps/${id}`);
  const card = page
    .locator("[data-slot=card]")
    .filter({ hasText: "Category ranks" });
  await expect(
    card.getByRole("region", { name: "Category chart position over time" }),
  ).toBeVisible();
  return card.locator("p.text-sm").first();
};

test("a paid app at the top of the paid chart reads its paid position", async ({
  page,
}) => {
  const stat = await headline(page, APP_PAID_TOP_CHART_ID);

  await expect(stat).toContainText("#2 in Games");
  await expect(stat).toContainText("paid chart");
  await expect(stat).not.toContainText("Not in top");
});

test("a paid app with no paid capture reads the grossing chart and says so", async ({
  page,
}) => {
  const stat = await headline(page, APP_PAID_GROSSING_ONLY_ID);

  await expect(stat).toContainText("#31 in Games");
  await expect(stat).toContainText("grossing chart");
});

test("a paid app outside every chart says it is not in the top 100", async ({
  page,
}) => {
  const stat = await headline(page, APP_PAID_UNRANKED_ID);

  await expect(stat).toContainText("Not in top 100 in Games");
  await expect(stat).toContainText("paid chart");
});

test("an app that went free reads the free chart, not its old paid position", async ({
  page,
}) => {
  const stat = await headline(page, APP_REPRICED_FREE_ID);

  await expect(stat).toContainText("#8 in Games");
  await expect(stat).toContainText("free chart");
  await expect(stat).not.toContainText("#4");
});

test("an app that went paid reads the paid chart, not its old free position", async ({
  page,
}) => {
  const stat = await headline(page, APP_REPRICED_PAID_ID);

  await expect(stat).toContainText("#6 in Games");
  await expect(stat).toContainText("paid chart");
  await expect(stat).not.toContainText("#25");
});

test("an app that went free again never reads its old free capture as current", async ({
  page,
}) => {
  const stat = await headline(page, APP_FREE_AGAIN_ID);

  await expect(stat).toContainText("Not in top 100 in Games");
  await expect(stat).toContainText("grossing chart");
  await expect(stat).not.toContainText("#12");
});

test("a free app with only an overall chart reads the overall position", async ({
  page,
}) => {
  const stat = await headline(page, APP_1_DETAIL.id);

  await expect(stat).toContainText("#42 in Overall");
  await expect(stat).toContainText("free chart");
});

test("the headline opens the chart it was read from", async ({ page }) => {
  const stat = await headline(page, APP_PAID_TOP_CHART_ID);
  const link = stat.getByRole("link");

  await expect(link).toHaveAttribute(
    "href",
    "/charts?store=APP_STORE&country=us&collection=paid&genre=6014&device=iphone",
  );
  await link.click();

  await expect(page).toHaveURL(/\/charts\?/);
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveText(
    "Games",
  );
  await expect(
    page
      .getByRole("tablist", { name: "Chart" })
      .getByRole("tab", { name: "Paid" }),
  ).toHaveAttribute("aria-selected", "true");
});
