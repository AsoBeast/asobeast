import type { Page, Request } from "@playwright/test";
import {
  APP_FIELD_PROPOSAL_ID,
  APP_FIELD_PROPOSAL_RIVAL_ID,
  APP_GP_DETAIL,
  FIELD_PROPOSAL_NOT_STOREFRONT,
} from "./fixtures.mts";
import { localizationItem, seedLocalizations } from "./localizations.mts";
import { expect, test } from "./session.mts";

const APP = APP_FIELD_PROPOSAL_ID;
const METADATA = `/apps/${APP}/metadata`;
const US = "English (U.S.)";
const UK = "English (U.K.)";

test.describe.configure({ mode: "serial" });

const proposal = (fieldLocale: string, fieldAdd: string) =>
  `${METADATA}?fieldLocale=${fieldLocale}&fieldAdd=${fieldAdd}#app-localizations`;

const editor = (page: Page, name: string) =>
  localizationItem(page, name).panel.getByRole("textbox", {
    name: `${name} keyword field`,
  });

const statusLine = (page: Page) =>
  page.getByRole("status").filter({ hasText: /keyword field|does not list/ });

function fieldWrites(page: Page): Request[] {
  const writes: Request[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PUT" &&
      request.url().includes(`/api/backend/apps/${APP}/keyword-fields/`)
    ) {
      writes.push(request);
    }
  });
  return writes;
}

test.describe("the metadata page takes proposed phrases", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalizations(page.request, APP, {
      markets: ["us"],
      fields: { "en-US": ["focus", "timer"] },
    });
  });

  test("opens the editor with the phrases unsaved", async ({ page }) => {
    const writes = fieldWrites(page);
    await page.goto(proposal("en-US", "deep+work,pomodoro"));

    await expect(localizationItem(page, US).trigger).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expect(editor(page, US)).toHaveValue(
      "focus,timer,deep work,pomodoro",
    );
    await expect(statusLine(page)).toHaveText(
      "Added 2 phrases from the keywords page to the English (U.S.) keyword field. Review them and save.",
    );
    await expect(
      localizationItem(page, US).panel.getByText("30/100", { exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(0);
  });

  test("saves through the dialog and drops the parameter", async ({ page }) => {
    const writes = fieldWrites(page);
    await page.goto(proposal("en-US", "deep+work,pomodoro"));
    await expect(editor(page, US)).toHaveValue(
      "focus,timer,deep work,pomodoro",
    );

    await page.getByRole("button", { name: "Save keyword field" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save and track" })
      .click();

    await expect(
      page.getByText("Saved the English (U.S.) keyword field"),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    await expect(page).not.toHaveURL(/fieldAdd=/);
    await expect(statusLine(page)).toHaveCount(0);

    await page.reload();
    await expect(editor(page, US)).toHaveValue(
      "focus,timer,deep work,pomodoro",
    );
    await expect(statusLine(page)).toHaveCount(0);
  });

  test("keeps the proposal with the localization the link named", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP, {
      markets: ["us", "gb"],
      fields: { "en-US": ["focus", "timer"], "en-GB": ["calm"] },
    });
    const writes = fieldWrites(page);
    await page.goto(proposal("en-US", "deep+work,pomodoro"));
    await expect(editor(page, US)).toHaveValue(
      "focus,timer,deep work,pomodoro",
    );

    await localizationItem(page, UK).trigger.click();

    await expect(page).not.toHaveURL(/fieldAdd=/);
    await expect(statusLine(page)).toHaveCount(0);
    await expect(editor(page, UK)).toHaveValue("calm");

    await localizationItem(page, US).trigger.click();
    await expect(editor(page, US)).toHaveValue(
      "focus,timer,deep work,pomodoro",
    );
    await editor(page, US).fill("focus,timer,deep work,pomodoros");
    await expect(editor(page, US)).toHaveValue(
      "focus,timer,deep work,pomodoros",
    );
    expect(writes).toHaveLength(0);
  });

  test("does not add a phrase the field already holds", async ({ page }) => {
    await page.goto(proposal("en-US", "timer,deep+work"));
    await expect(editor(page, US)).toHaveValue("focus,timer,deep work");
    await expect(statusLine(page)).toHaveText(
      "Added 1 phrase from the keywords page to the English (U.S.) keyword field. Review them and save.",
    );

    await page.goto(proposal("en-US", "focus,timer"));
    await expect(editor(page, US)).toHaveValue("focus,timer");
    await expect(statusLine(page)).toHaveCount(0);
  });

  test("leaves a field App Store Connect manages untouched", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP, {
      markets: ["us"],
      fields: { "en-US": ["focus", "timer"] },
      storeManaged: true,
    });
    await page.goto(proposal("en-US", "deep+work"));

    const panel = localizationItem(page, US).panel;
    await expect(editor(page, US)).toHaveValue("focus,timer");
    await expect(editor(page, US)).not.toBeEditable();
    await expect(
      panel.getByText("Imported from App Store Connect"),
    ).toBeVisible();
    await expect(statusLine(page)).toHaveText(
      "The selected phrases were not added, because App Store Connect manages the English (U.S.) keyword field.",
    );
    await expect(
      panel.getByRole("button", { name: "Save keyword field" }),
    ).toHaveCount(0);
  });

  test("says so when the app does not list the localization", async ({
    page,
  }) => {
    await page.goto(proposal("fr", "deep+work"));

    await expect(statusLine(page)).toHaveText(
      "The selected phrases were not added, because this app does not list French. Add it under Not listed yet, then send them again.",
    );
    await expect(editor(page, US)).toHaveValue("focus,timer");
  });

  test("shows a proposal that no longer fits as over the limit", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP, {
      markets: ["us"],
      fields: { "en-US": ["a".repeat(46), "b".repeat(48)] },
    });
    await page.goto(proposal("en-US", "deep+work"));

    const panel = localizationItem(page, US).panel;
    await expect(editor(page, US)).toHaveValue(
      `${"a".repeat(46)},${"b".repeat(48)},deep work`,
    );
    await expect(panel.getByText("105/100 · 5 over the limit")).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Save keyword field" }),
    ).toBeDisabled();
  });
});

test.describe("the keywords page sends its selection", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalizations(page.request, APP, {
      markets: ["us"],
      fields: { "en-US": ["focus", "timer"] },
    });
  });

  const keywordsPage = (id: string, query = "") =>
    `/apps/${id}/keywords${query}`;

  const bulkBar = (page: Page) =>
    page.getByRole("group", { name: "Bulk keyword actions" });

  const addToField = (page: Page) =>
    bulkBar(page).getByRole("link", { name: "Add to keyword field" });

  const select = async (page: Page, ...phrases: string[]) => {
    for (const phrase of phrases) {
      await page.getByRole("checkbox", { name: `Select ${phrase}` }).click();
    }
    await expect(bulkBar(page)).toContainText(`${phrases.length} selected`);
  };

  const toast = (page: Page, text: string) =>
    page.locator("[data-sonner-toast]").filter({ hasText: text });

  test("shows the action only where a keyword field exists", async ({
    page,
  }) => {
    await page.goto(keywordsPage(APP));
    await select(page, "deep work");
    await expect(addToField(page)).toBeVisible();

    await page.goto(
      keywordsPage(APP, `?country=${FIELD_PROPOSAL_NOT_STOREFRONT}`),
    );
    await select(page, "focus");
    await expect(addToField(page)).toHaveCount(0);

    await page.goto(keywordsPage(APP_FIELD_PROPOSAL_RIVAL_ID));
    await select(page, "deep work");
    await expect(addToField(page)).toHaveCount(0);

    await page.goto(keywordsPage(APP_GP_DETAIL.id));
    await page
      .getByRole("checkbox", { name: /^Select (?!all)/ })
      .first()
      .click();
    await expect(bulkBar(page)).toContainText("1 selected");
    await expect(addToField(page)).toHaveCount(0);
  });

  test("opens the editor with the selection in table order and saves it", async ({
    page,
  }) => {
    const writes = fieldWrites(page);
    await page.goto(keywordsPage(APP, "?sort=keyword&dir=desc"));
    await select(page, "deep work", "pomodoro");

    await addToField(page).click();

    await expect(page).toHaveURL(
      /\/metadata\?fieldLocale=en-US&fieldAdd=pomodoro,deep\+work#app-localizations$/,
    );
    await expect(editor(page, US)).toHaveValue(
      "focus,timer,pomodoro,deep work",
    );
    expect(writes).toHaveLength(0);

    await page.getByRole("button", { name: "Save keyword field" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save and track" })
      .click();
    await expect(
      page.getByText("Saved the English (U.S.) keyword field"),
    ).toBeVisible();
    await page.reload();
    await expect(editor(page, US)).toHaveValue(
      "focus,timer,pomodoro,deep work",
    );
  });

  test("carries only what fits and says what was left out", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP, {
      markets: ["us"],
      fields: { "en-US": ["a".repeat(45), "b".repeat(46)] },
    });
    await page.goto(keywordsPage(APP, "?sort=keyword&dir=asc"));
    await select(page, "deep work", "pomodoro", "zen");

    await addToField(page).click();

    await expect(
      toast(
        page,
        "2 keywords did not fit in the English (U.S.) keyword field and were left out.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/fieldLocale=en-US&fieldAdd=zen#/);
  });

  test("says when every selected keyword is already in the field", async ({
    page,
  }) => {
    await page.goto(keywordsPage(APP));
    await select(page, "focus", "timer");

    await addToField(page).click();

    await expect(
      toast(
        page,
        "Every selected keyword is already in the English (U.S.) keyword field.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/metadata\?fieldLocale=en-US#/);
    await expect(editor(page, US)).toHaveValue("focus,timer");
    await expect(statusLine(page)).toHaveCount(0);
  });

  test("targets the localization the market reads that the app ships", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP, {
      markets: ["us", "mx"],
      shipped: [{ localization: "en-GB", origin: "manual" }],
      fields: { "en-US": ["focus", "timer"] },
    });
    await page.goto(keywordsPage(APP, "?country=mx"));
    await select(page, "trabajo profundo");

    await expect(addToField(page)).toHaveAttribute(
      "href",
      /fieldLocale=en-GB&fieldAdd=trabajo\+profundo#/,
    );
  });

  test("adds nothing to a field App Store Connect manages", async ({
    page,
  }) => {
    await seedLocalizations(page.request, APP, {
      markets: ["us"],
      fields: { "en-US": ["focus", "timer"] },
      storeManaged: true,
    });
    await page.goto(keywordsPage(APP));
    await select(page, "deep work");

    await addToField(page).click();

    await expect(statusLine(page)).toHaveText(
      "The selected phrases were not added, because App Store Connect manages the English (U.S.) keyword field.",
    );
    await expect(editor(page, US)).toHaveValue("focus,timer");
  });
});
