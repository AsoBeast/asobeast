import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

const tile = (page: Page, name: RegExp) => page.getByRole("button", { name });

const movers = (page: Page) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Keyword movers" }) });

test("each figure draws its own chart and keeps it in the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  await expect(tile(page, /^Visibility/)).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await (await hydrated(tile(page, /^Keywords in top 10/))).click();

  await expect(page).toHaveURL(/visView=top10/);
  await expect(
    page.getByRole("region", { name: "Tracked keywords by rank band" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Keywords in each rank band today" }),
  ).toHaveText("#11#2–31#4–101#11–501#51+0Unranked1");
  await expect(tile(page, /^Visibility/)).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a share of voice link on an app without one falls back to visibility", async ({
  page,
}) => {
  await page.goto("/apps/app-gp?visView=share");

  await expect(tile(page, /^Share of voice/)).toHaveCount(0);
  await expect(tile(page, /^Visibility/)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("region", { name: "Search visibility over time" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Search visibility", exact: true }),
  ).toBeVisible();
});

test("the movers narrow to climbers or fallers and keep the choice in the url", async ({
  page,
}) => {
  await page.goto("/apps/app-1");
  const card = movers(page);
  await expect(card.getByRole("listitem")).toHaveCount(2);

  await (await hydrated(card.getByRole("tab", { name: "Fallers" }))).click();

  await expect(page).toHaveURL(/movers=down/);
  await expect(card.getByRole("listitem")).toHaveText([
    "pomodoro6 → 12▼ 6down 6 in 7 days",
  ]);

  await card.getByRole("tab", { name: "Climbers" }).click();

  await expect(page).toHaveURL(/movers=up/);
  await expect(card.getByRole("listitem")).toHaveText([
    "focus timer10 → 3▲ 7up 7 in 7 days",
  ]);
});

test("a market where nothing moved says so and offers no tabs", async ({
  page,
}) => {
  await page.goto("/apps/app-1?market=pl");
  const card = movers(page);

  await expect(card).toContainText("No keyword moved in the last 7 days.");
  await expect(card.getByRole("tablist")).toHaveCount(0);
});
