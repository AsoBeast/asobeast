import { type Page } from "@playwright/test";
import {
  PLAN_LIMITS,
  UPGRADE_PATH,
  type AccountPlan,
  type AuthUser,
} from "@asobeast/shared";
import { holdRequest } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import {
  chooseImportFile,
  openImportDialog,
  resetImportKeywords,
} from "./keyword-import-dialog.mts";
import { fulfillJson, routePlan } from "./plan-helpers.mts";
import { SERP_HISTORY_DAYS } from "./serp-history.mts";
import type { SerpEntryItem, SerpSnapshot } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { typeInto } from "./type.mts";

const TRIAL_PLAN: AccountPlan = {
  plan: "trial",
  displayName: "Trial",
  billing: true,
  entitled: true,
  hasBillingAccount: false,
  subscribed: false,
  cancelAtPeriodEnd: false,
  trialEndsAt: "2026-11-02T00:00:00.000Z",
  renewsAt: null,
  upgradeTo: "indie",
  upgradePath: UPGRADE_PATH,
  limits: PLAN_LIMITS.trial,
  usage: {
    apps: { used: 1, limit: PLAN_LIMITS.trial.apps },
    keywordMarkets: { used: 20, limit: PLAN_LIMITS.trial.keywordMarkets },
  },
};

const UNCONFIRMED_OWNER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: false,
  name: "Owner",
  role: "owner",
  plan: "free",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: false,
  trialAwaitsConfirmation: true,
  platformOperator: false,
};

function collectDomErrors(page: Page): string[] {
  const errors: string[] = [];
  const record = (message: string) => {
    if (/NotFoundError|insertBefore|removeChild/.test(message)) {
      errors.push(message);
    }
  };
  page.on("pageerror", (error) => record(`${error.name}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") record(message.text());
  });
  return errors;
}

async function openUpgrade(page: Page): Promise<void> {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(200, {
        billing: true,
        registrationOpen: true,
        setupRequired: false,
        authenticated: true,
      }),
    ),
  );
  await routePlan(page, TRIAL_PLAN);
  await page.route("**/api/backend/billing/catalog", (route) =>
    route.fulfill(
      fulfillJson(200, {
        enabled: true,
        prices: [
          {
            plan: "indie",
            interval: "month",
            priceId: "price_indie_month",
            amountUsd: 10,
          },
        ],
      }),
    ),
  );
  await page.goto("/upgrade");
}

async function translateText(page: Page): Promise<void> {
  await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const texts: Text[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode as Text);
    for (const text of texts.filter((node) => node.data.trim())) {
      const outer = document.createElement("font");
      const inner = document.createElement("font");
      inner.textContent = text.data.toUpperCase();
      outer.append(inner);
      text.replaceWith(outer);
    }
  });
}

test("a translated upgrade page keeps working when checkout starts", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  const checkout = await holdRequest(
    page,
    /\/api\/backend\/billing\/checkout$/,
    "POST",
    (route) => route.fulfill(fulfillJson(503, { message: "Try later" })),
  );
  await openUpgrade(page);
  const choose = await hydrated(
    page.getByRole("button", { name: "Choose Indie" }),
  );

  await translateText(page);
  await choose.click();

  await expect(choose.locator(".animate-spin")).toBeVisible();
  checkout.release();
  await expect(choose.locator(".animate-spin")).toHaveCount(0);
  await expect(choose).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated upgrade page shows the new label of a button it changed", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, UNCONFIRMED_OWNER)),
  );
  const resend = await holdRequest(
    page,
    /\/api\/backend\/auth\/verify\/resend$/,
    "POST",
    (route) => route.fulfill({ status: 204 }),
  );
  await openUpgrade(page);
  const button = await hydrated(
    page.getByRole("button", { name: "Send a new link" }),
  );

  await translateText(page);
  await button.click();

  await expect(button.locator(".animate-spin")).toBeVisible();
  resend.release();
  await expect(
    page.getByRole("button", { name: "New link sent" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("a translated settings page opens the delivery log", async ({ page }) => {
  const errors = collectDomErrors(page);
  await page.goto("/settings");
  const toggle = await hydrated(
    page.getByRole("button", { name: "Recent deliveries" }).last(),
  );

  await translateText(page);
  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText("Success", { exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

const REVIEW_FILTERS = [
  "Filter by date",
  "Filter by version",
  "Filter by reply state",
  "Sort reviews",
] as const;

test("a translated reviews page opens each of its filters", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-long/reviews");
  await hydrated(page.getByRole("combobox", { name: "Filter by date" }));

  await translateText(page);
  for (const name of REVIEW_FILTERS) {
    await page.getByRole("combobox", { name }).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  }
  await page.getByRole("combobox", { name: "Filter by date" }).click();
  await page.getByRole("option", { name: /last 30 days/i }).click();

  await expect(page).toHaveURL(/since=30d/);
  await expect(
    page.getByRole("combobox", { name: "Filter by date" }),
  ).toHaveText(/last 30 days/i);
  expect(errors).toEqual([]);
});

const PLAIN_LIST = "focus timer\ndeep work\n";

test.describe("a translated import dialog", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ request }) => {
    await resetImportKeywords(request);
  });

  test("closes with a file loaded", async ({ page }) => {
    const errors = collectDomErrors(page);
    const dialog = await openImportDialog(page);
    await chooseImportFile(dialog, PLAIN_LIST, "plain-list.txt");
    await expect(
      dialog.getByRole("row", { name: /focus timer/ }),
    ).toBeVisible();

    await translateText(page);
    await dialog.getByRole("button", { name: /cancel/i }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: /import csv/i }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("changes the market for rows without a country", async ({ page }) => {
    const errors = collectDomErrors(page);
    const dialog = await openImportDialog(page);
    await chooseImportFile(dialog, PLAIN_LIST, "plain-list.txt");
    const row = dialog.getByRole("row", { name: /focus timer/i });
    await expect(row).toContainText("US");

    await translateText(page);
    await dialog
      .getByRole("combobox", { name: "Market for rows without a country" })
      .click();
    await page.getByRole("option", { name: /PL/ }).click();

    await expect(row).toContainText(/pl/i);
    await expect(dialog).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("takes another file", async ({ page }) => {
    const errors = collectDomErrors(page);
    const dialog = await openImportDialog(page);
    await chooseImportFile(dialog, PLAIN_LIST, "plain-list.txt");
    await expect(
      dialog.getByRole("row", { name: /focus timer/ }),
    ).toBeVisible();

    await translateText(page);
    await chooseImportFile(dialog, "keyword,country\nzegar pracy,pl\n");

    await expect(
      dialog.getByRole("row", { name: /zegar pracy/ }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});

const flipped = (
  entry: SerpEntryItem,
  newest: readonly SerpEntryItem[],
): SerpEntryItem => {
  const rose = newest[entry.position - 1]?.movement === "up";
  const delta = rose && entry.position > 1 ? 1 : -1;
  return {
    ...entry,
    previous: entry.position - delta,
    delta,
    movement: delta < 0 ? "up" : "down",
    titleMatch: "none",
  };
};

async function rewriteEarlierDays(page: Page): Promise<void> {
  let newest: SerpEntryItem[] = [];
  await page.route("**/api/backend/keywords/kw-3/serp*", async (route) => {
    const response = await route.fetch();
    const snapshot = (await response.json()) as SerpSnapshot;
    if (!new URL(route.request().url()).searchParams.has("date")) {
      newest = snapshot.entries;
      return route.fulfill({ response, json: snapshot });
    }
    return route.fulfill({
      response,
      json: {
        ...snapshot,
        entries: snapshot.entries.map((entry) => flipped(entry, newest)),
      },
    });
  });
}

test("a translated search results sheet steps through its captured days", async ({
  page,
}) => {
  const [, YESTERDAY, DAY_BEFORE] = SERP_HISTORY_DAYS;
  const errors = collectDomErrors(page);
  await rewriteEarlierDays(page);
  await page.goto("/apps/app-1/keywords?serp=kw-3");
  const sheet = page.getByRole("dialog", { name: "Search results" });
  const summary = sheet.locator('[data-slot="serp-summary"]');
  await expect(sheet.locator("li#serp-row-1")).toBeVisible();
  await expect(summary).toContainText("7 of 10");
  const previous = await hydrated(
    sheet.getByRole("button", { name: "Previous captured day" }),
  );

  await translateText(page);
  await previous.click();
  await expect(page).toHaveURL(new RegExp(`serpDate=${YESTERDAY}`));
  await expect(sheet.locator("li#serp-row-1")).toBeVisible();
  await expect(summary).toContainText("0 of 10");
  await previous.click();
  await expect(page).toHaveURL(new RegExp(`serpDate=${DAY_BEFORE}`));
  await sheet.getByRole("button", { name: "Next captured day" }).click();
  await expect(page).toHaveURL(new RegExp(`serpDate=${YESTERDAY}`));

  await expect(summary).toBeVisible();
  expect(errors).toEqual([]);
});

const shownText = (text: string) =>
  text.replace(/\s+/g, " ").trim().toLowerCase();

test("a translated search results sheet shows the apps of the day it steps to", async ({
  page,
}) => {
  const [, YESTERDAY] = SERP_HISTORY_DAYS;
  await page.goto(`/apps/app-1/keywords?serp=kw-3&serpDate=${YESTERDAY}`);
  const sheet = page.getByRole("dialog", { name: "Search results" });
  const rows = sheet.locator('[data-slot="serp-row"]');
  await expect(sheet.locator("li#serp-row-5")).toContainText(
    "Timer for Study Sessions",
  );
  const untranslated = (await rows.allInnerTexts()).map(shownText);

  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/keywords?serp=kw-3");
  await expect(sheet.locator("li#serp-row-5")).toContainText(
    "Study Timer Daily",
  );
  const previous = await hydrated(
    sheet.getByRole("button", { name: "Previous captured day" }),
  );

  await translateText(page);
  await previous.click();
  await expect(page).toHaveURL(new RegExp(`serpDate=${YESTERDAY}`));

  await expect(sheet.locator("li#serp-row-5")).toContainText(
    /timer for study sessions/i,
  );
  await expect
    .poll(async () => (await rows.allInnerTexts()).map(shownText))
    .toEqual(untranslated);
  expect(errors).toEqual([]);
});

test("a translated keywords page counts the keywords it selects", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/keywords");
  await (
    await hydrated(page.getByRole("checkbox", { name: "Select focus timer" }))
  ).check();
  const bar = page.getByRole("group", { name: "Bulk keyword actions" });
  await expect(bar).toContainText("1 selected");

  await translateText(page);
  await page.getByRole("checkbox", { name: "Select study timer" }).check();

  await expect(bar).toContainText(/2 selected/i);
  expect(errors).toEqual([]);
});

test("a translated metadata page counts what is typed into a field", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1/metadata");
  const field = await hydrated(
    page.getByRole("textbox", { name: "Keyword field" }),
  );
  await typeInto(field, "focus,timer");
  const countId = await field.getAttribute("aria-describedby");
  const count = page.locator(`[id="${countId}"]`);
  await expect(count).toHaveText("11/100");

  await translateText(page);
  await typeInto(field, "ą".repeat(101));

  await expect(count).toHaveText("101/100 · 1 over");
  expect(errors).toEqual([]);
});

test("a translated overview names the market it switched to", async ({
  page,
}) => {
  const errors = collectDomErrors(page);
  await page.goto("/apps/app-1");
  const card = page
    .locator('[data-slot="card"]')
    .filter({ hasText: /in top 10/i });
  await expect(card).toContainText("Tracked keywords · All markets");
  const switcher = await hydrated(
    page.getByRole("combobox", { name: "Market" }),
  );

  await translateText(page);
  await switcher.click();
  await page.getByRole("option", { name: /PL · Poland/i }).click();

  await expect(page).toHaveURL(/market=pl/);
  await expect(card).toContainText(/tracked keywords · pl/i);
  expect(errors).toEqual([]);
});
