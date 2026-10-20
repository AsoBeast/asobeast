import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { hydrated } from "./hydrated.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-1/competitors";

const sheet = (page: Page) =>
  page.getByRole("dialog", { name: "Why apps rank for this keyword" });

const card = (page: Page, name: string | RegExp) =>
  sheet(page).getByRole("listitem", { name });

const keywordButton = (page: Page, market: string) =>
  page
    .getByRole("row", { name: /pomodoro/ })
    .filter({ hasText: market })
    .getByRole("button", { name: "pomodoro, why apps rank" });

async function openPomodoro(page: Page): Promise<void> {
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");
  await (await hydrated(keywordButton(page, "United States"))).click();
  await expect(sheet(page)).toBeVisible();
}

test("pressing a keyword opens its breakdown", async ({ page }) => {
  await openPomodoro(page);

  await expect(page).toHaveURL(/keyword=kw-2/);
  await expect(sheet(page)).toHaveAccessibleDescription(
    /pomodoro.*United States/,
  );
});

test("you come first and a competitor above you carries a note", async ({
  page,
}) => {
  await openPomodoro(page);

  const cards = sheet(page).getByRole("listitem");
  await expect(cards.first()).toHaveAccessibleName(/Focus Timer.*You/);
  const rival = card(page, /Rival Focus/);
  await expect(rival).toContainText("Position 4");
  await expect(
    rival.getByRole("note", { name: "Why it may rank above you" }),
  ).toContainText("May rank above you because it has the keyword in its title");
  await expect(
    cards.first().getByRole("note", { name: "Where you stand" }),
  ).toContainText("1 of 1 competitor ranks above you.");
});

test("the keyword's words are marked", async ({ page }) => {
  await openPomodoro(page);

  await expect(card(page, /Rival Focus/).locator("mark")).toHaveText(
    "Pomodoro",
  );
  await expect(
    card(page, /Focus Timer/).locator("mark", { hasText: "Pomodóro" }),
  ).toHaveText("Pomodóro (accents differ)");
});

test("a localization it could not read is named", async ({ page }) => {
  await openPomodoro(page);

  await expect(card(page, /Rival Focus/)).toContainText(
    "Not read: Spanish (Mexico).",
  );
});

test("never checked and not found read as such", async ({ page }) => {
  await page.goto(`${PAGE}?keyword=kw-5`);
  await expect(card(page, /Rival Focus/)).toContainText("Not checked yet");

  await page.goto(`${PAGE}?keyword=kw-4`);
  await expect(card(page, /Focus Timer/)).toContainText(">200");
  await expect(card(page, /Rival Focus/)).toContainText(
    "may rank through its private keyword field",
  );
});

test("a competitor with only some of the words is not told it shows no match", async ({
  page,
}) => {
  await page.goto(`${PAGE}?keyword=kw-6`);
  const rival = card(page, /Rival Focus/);
  const note = rival.getByRole("note", { name: "Why it may rank above you" });

  await expect(rival).toContainText("1 of 2 words");
  await expect(note).toContainText(
    "Only some of the words show in any listing this market searches, so it may rank through its private keyword field.",
  );
  await expect(note).not.toContainText("No visible match");
});

test("the unread note of a partial match says only some of the words show", async ({
  page,
}) => {
  await page.goto(`${PAGE}?keyword=kw-7`);
  const note = card(page, /Rival Focus/).getByRole("note", {
    name: "Why it may rank above you",
  });

  await expect(note).toContainText(
    "Only some of the words show in what AsoBeast read, and its Spanish (Mexico) listing has not been captured.",
  );
  await expect(note).not.toContainText("No visible match");
});

test("a market without a listing says which listing was read", async ({
  page,
}) => {
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");
  await (await hydrated(keywordButton(page, "Germany"))).click();

  await expect(page).toHaveURL(/keyword=kw-de-1/);
  await expect(card(page, /Rival Focus/)).toContainText(
    "No Germany listing captured for this app, so its United States listing was read.",
  );
});

test("escape closes the sheet and focus returns to the keyword", async ({
  page,
}) => {
  await openPomodoro(page);

  await page.keyboard.press("Escape");

  await expect(sheet(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/keyword=/);
  await expect(keywordButton(page, "United States")).toBeFocused();
});

test("a link opens the breakdown", async ({ page }) => {
  await page.goto(`${PAGE}?keyword=kw-2`);

  await expect(sheet(page)).toBeVisible();
  await expect(card(page, /Rival Focus/)).toBeVisible();
});

test("a link opens the breakdown while the matrix is collapsed", async ({
  page,
  context,
}) => {
  await seedCookies(context, {
    asobeast_collapsed: encodeURIComponent("competitors.matrix"),
  });
  await page.goto(`${PAGE}?keyword=kw-2`);

  await expect(sheet(page)).toBeVisible();
  await expect(card(page, /Rival Focus/)).toBeVisible();
  await sheet(page).getByRole("button", { name: "Close", exact: true }).click();

  await expect(
    page.getByRole("button", {
      name: "Your position against every competitor",
      exact: true,
    }),
  ).toBeFocused();
});

test("a keyword no longer tracked says so", async ({ page }) => {
  await page.goto(`${PAGE}?keyword=kw-nope`);

  await expect(sheet(page)).toContainText(
    "This keyword is not tracked any more.",
  );
  await expect(sheet(page)).not.toHaveAccessibleDescription(/Loading/);
  await sheet(page)
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await expect(page).not.toHaveURL(/keyword=/);
});

test("a failed load offers a retry", async ({ page, context }) => {
  await seedCookies(context, { "e2e-fail-breakdown": "1" });
  await page.goto(`${PAGE}?keyword=kw-2`);

  await expect(sheet(page).getByRole("alert")).toHaveText(
    "The breakdown could not be loaded.",
    { timeout: 15_000 },
  );
  await expect(sheet(page)).not.toHaveAccessibleDescription(/Loading/);
  await context.clearCookies({ name: "e2e-fail-breakdown" });
  await sheet(page).getByRole("button", { name: "Retry" }).click();

  await expect(card(page, /Rival Focus/)).toBeVisible();
});

test("a google play breakdown judges the long description without showing it", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/competitors?keyword=kw-gp-1");

  const you = card(page, /Tomato Clock/);
  await expect(you).toContainText("Long description");
  await expect(you).toContainText("Whole phrase");
  await expect(you).not.toContainText("Der Pomodoro Timer für jeden Tag");
});

test("the sheet fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`${PAGE}?keyword=kw-2`);
  await expect(card(page, /Rival Focus/)).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const theme of THEMES) {
  test(`the open sheet has no accessibility violation in the ${theme} theme`, async ({
    page,
  }) => {
    expect(
      await contrastViolations(page, theme, `${PAGE}?keyword=kw-2`),
    ).toEqual([]);
    await expect(card(page, /Rival Focus/)).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withRules([
        "aria-valid-attr-value",
        "aria-prohibited-attr",
        "color-contrast",
        "list",
        "listitem",
      ])
      .analyze();
    expect(violations.map(({ id }) => id)).toEqual([]);
  });
}
