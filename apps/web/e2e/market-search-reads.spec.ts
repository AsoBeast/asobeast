import type { Page } from "@playwright/test";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import { APP_READS_ID, type LocalizationSeed } from "./fixtures.mts";
import {
  fieldRequests,
  localizationItem,
  seedLocalizations,
} from "./localizations.mts";
import { expect, test } from "./session.mts";

const APP = APP_READS_ID;
const KEYWORDS = `/apps/${APP}/keywords`;

const READS_SEED = {
  shipped: [{ localization: "es-MX", origin: "manual" }],
  fields: {
    "en-US": ["habit tracker", "streak"],
    "es-MX": ["hábito", "racha"],
  },
} satisfies LocalizationSeed;

const card = (page: Page, market: string) =>
  page.getByRole("region", { name: `What ${market} search reads` });

test.describe("on the read lab", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await seedLocalizations(page.request, APP, READS_SEED);
  });

  test("says what the home market search reads", async ({ page }) => {
    await page.goto(KEYWORDS);

    const us = card(page, "US");
    await expect(us).toContainText("5 unique words · 2 localizations");
    const rows = us.getByRole("listitem");
    await expect(rows.nth(0)).toContainText("English (U.S.)");
    await expect(rows.nth(0)).toContainText("Default");
    await expect(rows.nth(0)).toContainText("20/100");
    await expect(rows.nth(1)).toContainText("Spanish (Mexico)");
    await expect(rows.nth(1)).toContainText("Also");
    await expect(rows.nth(1)).toContainText("12/100");
  });

  test("shows Empty for a shipped localization without phrases", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP, {
      shipped: [{ localization: "es-MX", origin: "manual" }],
    });
    await page.goto(KEYWORDS);

    const us = card(page, "US");
    await expect(us).toContainText("0 unique words · 2 localizations");
    await expect(us.getByText("Empty", { exact: true })).toHaveCount(2);
  });

  test("links each row to its editor on the metadata page", async ({
    page,
  }) => {
    await page.goto(KEYWORDS);
    const edit = card(page, "US").getByRole("link", {
      name: "Edit the Spanish (Mexico) keyword field",
    });

    await expect(edit).toHaveAttribute(
      "href",
      `/apps/${APP}/metadata?fieldLocale=es-MX#app-localizations`,
    );
    await edit.click();

    await expect(page).toHaveURL(
      new RegExp(
        `/apps/${APP}/metadata\\?fieldLocale=es-MX#app-localizations$`,
      ),
    );
    await expect(
      localizationItem(page, "Spanish (Mexico)").trigger,
    ).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByRole("textbox", { name: "Spanish (Mexico) keyword field" }),
    ).toHaveValue("hábito,racha");
    await expect(
      page.getByRole("region", { name: "App Store localizations" }),
    ).toBeInViewport();
  });

  test("folds the localizations the market reads and the app does not ship", async ({
    page,
  }) => {
    await page.goto(KEYWORDS);
    const fold = card(page, "US").locator("details");

    await expect(fold).not.toHaveAttribute("open", "");
    await expect(fold.locator("summary")).toHaveText(
      "US also reads 8 localizations you don't ship · up to 800 more characters",
    );
    await fold.locator("summary").click();
    await expect(fold.getByRole("listitem")).toHaveText([
      "Arabic",
      "Chinese (Simplified)",
      "Chinese (Traditional)",
      "French",
      "Korean",
      "Portuguese (Brazil)",
      "Russian",
      "Vietnamese",
    ]);
    await expect(
      fold.getByRole("link", { name: "Add one on the metadata page" }),
    ).toHaveAttribute("href", `/apps/${APP}/metadata#app-localizations`);
  });

  test("shows no fold when the app ships everything the market reads", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP, {
      shipped: [{ localization: "en-GB", origin: "manual" }],
    });
    await page.goto(`${KEYWORDS}?country=gb`);

    const gb = card(page, "GB");
    await expect(gb.getByRole("listitem")).toHaveCount(1);
    await expect(gb.getByRole("listitem")).toContainText("English (U.K.)");
    await expect(gb.getByRole("listitem")).toContainText("Default");
    await expect(gb.locator("details")).toHaveCount(0);
  });

  test("explains that a code which is no storefront has no keyword field, without asking", async ({
    page,
  }) => {
    await page.goto(`${KEYWORDS}?country=zz`);

    await expect(card(page, "ZZ")).toContainText(
      "ZZ is not an App Store storefront, so it has no keyword field.",
    );
    expect(await fieldRequests(page.request, APP)).toEqual([]);
    await expect(
      page.getByRole("button", { name: "Import CSV" }).first(),
    ).toBeVisible();
  });

  test("a google play app has no card and asks for nothing", async ({
    page,
  }) => {
    await page.goto(KEYWORDS);
    await expect(card(page, "US")).toBeVisible();
    expect(await fieldRequests(page.request, APP)).toEqual([
      `GET /apps/${APP}/keyword-fields/market?country=us`,
    ]);

    const requested: string[] = [];
    page.on("request", (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.includes("/keyword-fields")) requested.push(pathname);
    });
    await page.goto("/apps/app-gp/keywords");

    await expect(
      page.getByRole("heading", { name: "Tracked keywords" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: /^What / })).toHaveCount(0);
    expect(await fieldRequests(page.request, "app-gp")).toEqual([]);
    expect(requested).toEqual([]);
  });

  test("arrives with the page and the browser never asks for it", async ({
    page,
  }) => {
    const html = await page.request
      .get(KEYWORDS)
      .then((response) => response.text());
    expect(html).toContain("What US search reads");
    await seedLocalizations(page.request, APP, READS_SEED);

    const requested: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.includes("/keyword-fields")) {
        requested.push(request.url());
      }
    });
    await page.goto(KEYWORDS);
    await expect(card(page, "US")).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(requested).toEqual([]);
    expect(await fieldRequests(page.request, APP)).toEqual([
      `GET /apps/${APP}/keyword-fields/market?country=us`,
    ]);
  });

  test("ignores ?fieldLocale= on the keywords page", async ({ page }) => {
    await page.goto(`${KEYWORDS}?fieldLocale=es-MX`);

    await expect(card(page, "US")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /keyword field/i }),
    ).toHaveCount(0);
  });

  test("explains the card in a popover", async ({ page }) => {
    await page.goto(KEYWORDS);

    await card(page, "US")
      .getByRole("button", { name: "About market keyword fields" })
      .click();

    await expect(
      page.getByText(
        "Search in a storefront reads the keyword field of every localization on its list. Words combine only within one localization.",
      ),
    ).toBeVisible();
  });

  test("opens the fold when the market reads none of the shipped localizations", async ({
    page,
  }) => {
    await page.goto(`${KEYWORDS}?country=de`);

    const de = card(page, "DE");
    await expect(de).toContainText(
      "DE reads none of the localizations this app ships.",
    );
    await expect(de).toContainText("0 unique words · 0 localizations");
    const fold = de.locator("details");
    await expect(fold).toHaveAttribute("open", "");
    await expect(fold.getByRole("listitem")).toHaveText([
      "German",
      "English (U.K.)",
    ]);
  });
});

test("reads another market of an app that tracks it", async ({ page }) => {
  await page.goto("/apps/app-1/keywords?country=pl");

  const pl = card(page, "PL");
  await expect(pl.getByRole("list").first().getByRole("listitem")).toHaveCount(
    2,
  );
  await expect(pl.getByRole("listitem").nth(0)).toContainText("English (U.K.)");
  await expect(pl.getByRole("listitem").nth(0)).toContainText("Default");
  await expect(pl.getByRole("listitem").nth(1)).toContainText("Polish");
  await expect(pl.getByRole("listitem").nth(1)).toContainText("Also");
  await expect(pl.locator("details")).toHaveCount(0);

  await page.goto("/apps/app-1/keywords?country=gb");
  const gb = card(page, "GB");
  await expect(gb.getByRole("listitem")).toHaveCount(1);
  await expect(gb.getByRole("listitem")).toContainText("English (U.K.)");
});

test.describe("wasted keyword field words", () => {
  const note = (page: Page, title: string) =>
    page.getByRole("note").filter({ hasText: title });

  test("warns about a word the market reads twice", async ({ page }) => {
    await page.goto("/apps/app-1/keywords");

    await expect(note(page, "Words read twice")).toContainText(
      '"tracker" is in English (U.S.) and Spanish (Mexico).',
    );
    await expect(
      page.getByRole("alert").filter({ hasText: "Words read twice" }),
    ).toHaveCount(0);
  });

  test("warns about a phrase split across localizations", async ({ page }) => {
    await page.goto("/apps/app-1/keywords");

    await expect(
      note(page, "Phrases split across localizations"),
    ).toContainText(
      '"habit planner": habit in English (U.S.), planner in Spanish (Mexico).',
    );
  });

  test("lists five words and counts the rest", async ({ page }) => {
    await page.goto("/apps/app-1/keywords?country=mx");

    const words = note(page, "Words read twice");
    await expect(words.getByRole("listitem")).toHaveCount(5);
    await expect(words).toContainText("and 2 more");
  });

  test("shows no warning for a market without repeats", async ({ page }) => {
    await page.goto("/apps/app-1/keywords?country=de");

    await expect(card(page, "DE")).toBeVisible();
    await expect(note(page, "Words read twice")).toHaveCount(0);
    await expect(note(page, "Phrases split across localizations")).toHaveCount(
      0,
    );
  });

  test("keeps the warnings below the localization rows", async ({ page }) => {
    await page.goto("/apps/app-1/keywords");

    const lastRow = card(page, "US")
      .getByRole("list")
      .first()
      .getByRole("listitem")
      .last();
    const firstNote = note(page, "Words read twice");
    await expect(firstNote).toBeVisible();
    const follows = await lastRow.evaluate(
      (row, other) =>
        Boolean(
          row.compareDocumentPosition(other as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      await firstNote.elementHandle(),
    );
    expect(follows).toBe(true);
  });

  for (const theme of THEMES) {
    test(`keeps the warnings readable in the ${theme} theme`, async ({
      page,
    }) => {
      expect(
        await contrastViolations(page, theme, "/apps/app-1/keywords"),
      ).toEqual([]);
      await expect(note(page, "Words read twice")).toBeVisible();
      await expect(
        note(page, "Phrases split across localizations"),
      ).toBeVisible();
    });
  }
});
