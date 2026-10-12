import type { Page } from "@playwright/test";
import type { AppLocalizationsResult } from "@asobeast/shared";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import type { LocalizationSeed } from "./fixtures.mts";
import { expectFitsViewport } from "./dialog.mts";
import {
  fieldRequests,
  LOCALES_APP,
  localizationItem,
  MOCK_API_URL,
  QUOTA_COOKIE,
  seedLocalizations,
} from "./localizations.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";
import { typeInto } from "./type.mts";

const SECTION = "App Store localizations";
const APPLE_URL =
  "https://developer.apple.com/help/app-store-connect/reference/app-store-localizations/";
const MX_SEED = {
  markets: ["mx"],
  shipped: [{ localization: "es-MX", origin: "manual" }],
} satisfies LocalizationSeed;
const LOCALES_METADATA = `/apps/${LOCALES_APP}/metadata`;

test("replaces the storefront card with the app store localizations section", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const section = page.getByRole("region", { name: SECTION });
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Screenshot captions",
    SECTION,
    "Keyword coverage",
  ]);
  await expect(
    page.getByRole("region", { name: "Storefront localizations" }),
  ).toHaveCount(0);
  await expect(
    section.getByText("A keyword field belongs to a language"),
  ).toBeVisible();
  await expect(
    section.getByRole("link", { name: /Apple.s localization table/ }),
  ).toHaveAttribute("href", APPLE_URL);
  await expect(
    section.getByText(
      "Each localization has its own 30 character title, 30 character subtitle and 100 character keyword field.",
    ),
  ).toBeVisible();
});

test("lists one accordion item per shipped localization with the markets that read it", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const triggers = page
    .getByRole("region", { name: SECTION })
    .locator("[data-slot=accordion-trigger]");
  await expect(triggers).toHaveCount(4);
  await expect(triggers.nth(0)).toContainText("English (U.S.)");
  await expect(triggers.nth(1)).toContainText("English (U.K.)");
  await expect(triggers.nth(2)).toContainText("Polish");
  await expect(triggers.nth(3)).toContainText("Spanish (Mexico)");

  const us = localizationItem(page, "English (U.S.)").trigger;
  await expect(us).toContainText("Home");
  await expect(us).toContainText("US · Default");
  const gb = localizationItem(page, "English (U.K.)").trigger;
  await expect(gb).toContainText("GB · Default");
  await expect(gb).toContainText("PL · Default");
  const pl = localizationItem(page, "Polish").trigger;
  await expect(pl).toContainText("Detected");
  await expect(pl).toContainText("PL · Also");
  await expect(
    localizationItem(page, "Spanish (Mexico)").trigger,
  ).toContainText("US · Also");
});

test("shows which of your markets read each localization in a matrix", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");

  const matrix = page.getByRole("table", {
    name: "Which of your markets read each localization",
  });
  await expect(matrix.getByRole("columnheader")).toHaveText([
    "Read in your markets",
    "US United States",
    "GB United Kingdom",
    "PL Poland",
  ]);
  const cellsOf = (name: string) =>
    matrix
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: new RegExp(name) }) })
      .getByRole("cell");
  await expect(cellsOf("English \\(U\\.K\\.\\)")).toContainText([
    "Not read",
    "Default",
    "Default",
  ]);
  await expect(cellsOf("Spanish \\(Mexico\\)")).toContainText([
    "Also",
    "Not read",
    "Not read",
  ]);
  await expect(cellsOf("Polish")).toContainText([
    "Not read",
    "Not read",
    "Also",
  ]);
});

test("opens the item that ?fieldLocale= names and leaves the others closed", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata?fieldLocale=es-MX");

  const spanish = localizationItem(page, "Spanish (Mexico)");
  await expect(spanish.trigger).toHaveAttribute("aria-expanded", "true");
  for (const name of ["English (U.S.)", "English (U.K.)", "Polish"]) {
    await expect(localizationItem(page, name).trigger).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }
  await expect(
    page.getByRole("textbox", { name: "Spanish (Mexico) keyword field" }),
  ).toHaveValue("temporizador,enfoque");
  await expect(spanish.panel.getByText("20/100")).toBeVisible();
});

test("writes the open item into the url without adding history", async ({
  page,
}) => {
  await page.goto("/apps/app-1/metadata");
  const length = await page.evaluate(() => history.length);
  const polish = localizationItem(page, "Polish").trigger;

  await polish.click();
  await expect(page).toHaveURL(/fieldLocale=pl/);
  expect(await page.evaluate(() => history.length)).toBe(length);

  await polish.click();
  await expect(page).not.toHaveURL(/fieldLocale/);
  expect(await page.evaluate(() => history.length)).toBe(length);
});

test("offers drafting with ai on every localization but the home one", async ({
  context,
  page,
}) => {
  await seedCookies(context, { e2e_metadata_ai: "1" });

  await page.goto("/apps/app-1/metadata?fieldLocale=en-US");
  await expect(
    page.getByRole("textbox", { name: "English (U.S.) keyword field" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Draft with AI: English (U.S.)" }),
  ).toHaveCount(0);

  await page.goto("/apps/app-1/metadata?fieldLocale=es-MX");
  const draft = page.getByRole("button", {
    name: "Draft with AI: Spanish (Mexico)",
  });
  await expect(draft).toBeVisible();
  await draft.click();
  await expect(page).toHaveURL(/draftLocale=es-MX/);
});

test("says so and retries when the localizations cannot be loaded", async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: "e2e-localizations-error",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-1/metadata");

  await expect(
    page.getByText("Localizations could not be loaded."),
  ).toBeVisible();
  await expect(page.getByText("Metadata could not be loaded")).toHaveCount(0);

  await context.clearCookies({ name: "e2e-localizations-error" });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    localizationItem(page, "Spanish (Mexico)").trigger,
  ).toBeVisible();
});

for (const theme of THEMES) {
  test(`has no contrast violation with a localization open in the ${theme} theme`, async ({
    page,
  }) => {
    expect(
      await contrastViolations(
        page,
        theme,
        "/apps/app-1/metadata?fieldLocale=es-MX",
      ),
    ).toEqual([]);
  });
}

test.describe("on the locale lab", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await seedLocalizations(page.request, LOCALES_APP);
  });

  const editor = (page: Page, name: string) =>
    page.getByRole("textbox", { name: `${name} keyword field` });

  const save = (page: Page) =>
    page.getByRole("button", { name: "Save keyword field" });

  const confirmSave = (page: Page) =>
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Save and track" })
      .click();

  test("arrives with the page and the browser never asks for it", async ({
    page,
  }) => {
    const html = await page.request
      .get(LOCALES_METADATA)
      .then((response) => response.text());
    expect(html).toContain("A keyword field belongs to a language");
    await seedLocalizations(page.request, LOCALES_APP);

    const requested: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith("/localizations")) {
        requested.push(request.url());
      }
    });
    await page.goto(LOCALES_METADATA);
    await page.waitForLoadState("networkidle");

    expect(requested).toEqual([]);
    expect(await fieldRequests(page.request, LOCALES_APP)).toEqual([
      `GET /apps/${LOCALES_APP}/localizations`,
    ]);
  });

  test("a google play app gets no section and asks for no localization or keyword field", async ({
    page,
  }) => {
    await page.goto(LOCALES_METADATA);
    await expect(page.getByRole("region", { name: SECTION })).toBeVisible();
    expect(await fieldRequests(page.request, LOCALES_APP)).toHaveLength(1);

    const requested: string[] = [];
    page.on("request", (request) => {
      const { pathname } = new URL(request.url());
      if (
        pathname.includes("/localizations") ||
        pathname.includes("/keyword-field")
      ) {
        requested.push(pathname);
      }
    });
    await page.goto("/apps/app-gp/metadata");

    await expect(
      page.getByRole("heading", { name: "Keyword coverage" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: SECTION })).toHaveCount(0);
    expect(await fieldRequests(page.request, "app-gp")).toEqual([]);
    expect(requested).toEqual([]);
  });

  test("hides the matrix when there is one market and one localization", async ({
    page,
  }) => {
    await page.goto(LOCALES_METADATA);
    await expect(editor(page, "English (U.S.)")).toBeVisible();
    await expect(
      page.getByRole("region", { name: SECTION }).getByRole("table"),
    ).toHaveCount(0);

    await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
    await page.reload();
    const matrix = page.getByRole("table", {
      name: "Which of your markets read each localization",
    });
    await expect(matrix.getByRole("columnheader")).toHaveText([
      "Read in your markets",
      "US United States",
      "MX Mexico",
    ]);
  });

  test("opens the only localization of an app and keeps it open", async ({
    page,
  }) => {
    await page.goto(LOCALES_METADATA);

    const { trigger } = localizationItem(page, "English (U.S.)");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(trigger).toHaveAttribute("aria-disabled", "true");
    await trigger.click({ force: true });
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(editor(page, "English (U.S.)")).toBeVisible();
  });

  test("names the storefronts that read a localization none of your markets reads", async ({
    page,
  }) => {
    await seedLocalizations(page.request, LOCALES_APP, {
      shipped: [{ localization: "ja", origin: "manual" }],
    });
    await page.goto(`${LOCALES_METADATA}?fieldLocale=ja`);

    const japanese = localizationItem(page, "Japanese");
    await expect(japanese.trigger).toContainText("Not read in your markets");
    await expect(japanese.panel).toContainText(
      "None of your markets reads Japanese. Storefronts that read it: Japan.",
    );
    await expect(japanese.panel).toContainText(
      "Add one of them as a keyword market to track these phrases there.",
    );
  });

  test("counts letters such as ą once, as App Store Connect does", async ({
    page,
  }) => {
    await page.goto(LOCALES_METADATA);
    const box = editor(page, "English (U.S.)");

    await typeInto(
      box,
      "geoguessr,geoguess,zgadywanka,stolice,miasto,lokalizacja,państwo,podróże,zabytki,odkrywca,kontynenty",
    );

    await expect(page.getByText("100/100", { exact: true })).toBeVisible();
    await expect(save(page)).toBeEnabled();
    await expect(box).not.toHaveAttribute("aria-invalid", "true");
  });

  test("refuses to save past the character limit", async ({ page }) => {
    await page.goto(LOCALES_METADATA);
    const box = editor(page, "English (U.S.)");

    await typeInto(box, "a".repeat(100));
    await expect(page.getByText("100/100", { exact: true })).toBeVisible();
    await expect(save(page)).toBeEnabled();

    await typeInto(box, "a".repeat(105));
    await expect(page.getByText("5 over the limit")).toBeVisible();
    await expect(save(page)).toBeDisabled();
    await expect(box).toHaveAttribute("aria-invalid", "true");
  });

  test("ignores duplicates the api drops", async ({ page }) => {
    await page.goto(LOCALES_METADATA);

    await typeInto(editor(page, "English (U.S.)"), "a,".repeat(60));

    await expect(
      localizationItem(page, "English (U.S.)").panel.getByText("1/100", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(save(page)).toBeEnabled();
  });

  test("ignores spacing after commas", async ({ page }) => {
    await page.goto(LOCALES_METADATA);

    await typeInto(editor(page, "English (U.S.)"), "fitness, workout, running");

    const panel = localizationItem(page, "English (U.S.)").panel;
    await expect(panel.getByText("23/100", { exact: true })).toBeVisible();
    await expect(
      panel.getByText("Stored as fitness,workout,running"),
    ).toBeVisible();
  });

  test("collapses case and repetition into one phrase", async ({ page }) => {
    await page.goto(LOCALES_METADATA);

    await typeInto(editor(page, "English (U.S.)"), "Fitness,FITNESS, fitness");

    const panel = localizationItem(page, "English (U.S.)").panel;
    await expect(panel.getByText("7/100", { exact: true })).toBeVisible();
    await expect(panel.getByText("Stored as fitness")).toBeVisible();
  });

  test("keeps Save disabled only for an untouched empty field", async ({
    page,
  }) => {
    await seedLocalizations(page.request, LOCALES_APP, {
      shipped: [{ localization: "es-MX", origin: "manual" }],
      fields: {},
    });
    await page.goto(`${LOCALES_METADATA}?fieldLocale=es-MX`);
    await expect(save(page)).toBeDisabled();
    await typeInto(editor(page, "Spanish (Mexico)"), "alpha");
    await expect(save(page)).toBeEnabled();

    await seedLocalizations(page.request, LOCALES_APP, {
      fields: { "en-US": ["alpha", "beta"] },
    });
    await page.goto(LOCALES_METADATA);
    await expect(editor(page, "English (U.S.)")).toHaveValue("alpha,beta");
    await expect(save(page)).toBeEnabled();
    const put = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        request.url().endsWith("/keyword-fields/en-US"),
    );
    await save(page).click();
    await expect(
      page.getByRole("dialog").getByText("2 new", { exact: true }),
    ).toBeVisible();
    await confirmSave(page);
    expect((await put).postDataJSON()).toEqual({
      text: "alpha,beta",
      trackIn: ["us"],
    });
  });

  test("keeps an unsaved draft when its item closes and reopens", async ({
    page,
  }) => {
    await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
    await page.goto(LOCALES_METADATA);
    const { trigger } = localizationItem(page, "English (U.S.)");
    const box = editor(page, "English (U.S.)");

    await trigger.click();
    await typeInto(box, "alpha,beta");
    await trigger.click();
    await expect(box).toBeHidden();
    await expect(save(page)).toHaveCount(0);

    await trigger.click();
    await expect(box).toHaveValue("alpha,beta");
    await expect(save(page)).toBeEnabled();
  });

  test("saves the field into every market that reads it and keeps it after a reload", async ({
    page,
  }) => {
    await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
    await page.goto(`${LOCALES_METADATA}?fieldLocale=es-MX`);
    const box = editor(page, "Spanish (Mexico)");

    await typeInto(box, "temporizador");
    const put = page.waitForRequest(
      (request) =>
        request.method() === "PUT" &&
        request.url().endsWith("/keyword-fields/es-MX"),
    );
    await save(page).click();
    await confirmSave(page);

    expect((await put).postDataJSON()).toEqual({
      text: "temporizador",
      trackIn: ["us", "mx"],
    });
    await expect(
      page.getByText("Saved the Spanish (Mexico) keyword field"),
    ).toBeVisible();
    await expect(
      page.getByText("1 phrase tracked in United States and Mexico"),
    ).toBeVisible();
    await expect(
      localizationItem(page, "Spanish (Mexico)").trigger,
    ).toContainText("12/100");

    await page.reload();
    await expect(box).toHaveValue("temporizador");
  });

  test("can be emptied, which is how its phrases are untracked", async ({
    page,
  }) => {
    await seedLocalizations(page.request, LOCALES_APP, {
      ...MX_SEED,
      fields: { "es-MX": ["a", "b"] },
      tracked: { us: ["a", "b"], mx: ["a", "b"] },
    });
    await page.goto(`${LOCALES_METADATA}?fieldLocale=es-MX`);
    const box = editor(page, "Spanish (Mexico)");

    await typeInto(box, "");
    await save(page).click();
    await confirmSave(page);

    await expect(page.getByText("The field is empty.")).toBeVisible();
    await page.reload();
    await expect(box).toHaveValue("");
    const listed = (await (
      await page.request.get(
        `${MOCK_API_URL}/apps/${LOCALES_APP}/localizations`,
      )
    ).json()) as AppLocalizationsResult;
    expect(
      listed.localizations.find((item) => item.localization === "es-MX"),
    ).toMatchObject({ phrases: [], origin: "manual" });
  });

  test("saves two localizations side by side", async ({ page }) => {
    await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
    await page.goto(LOCALES_METADATA);
    const english = localizationItem(page, "English (U.S.)").trigger;
    const spanish = localizationItem(page, "Spanish (Mexico)").trigger;

    await english.click();
    await typeInto(editor(page, "English (U.S.)"), "focus timer");
    await save(page).click();
    await confirmSave(page);
    await expect(
      page.getByText("Saved the English (U.S.) keyword field"),
    ).toBeVisible();

    await spanish.click();
    await typeInto(editor(page, "Spanish (Mexico)"), "temporizador");
    await save(page).click();
    await confirmSave(page);
    await expect(
      page.getByText("Saved the Spanish (Mexico) keyword field"),
    ).toBeVisible();

    await page.reload();
    await expect(editor(page, "Spanish (Mexico)")).toHaveValue("temporizador");
    await english.click();
    await expect(editor(page, "English (U.S.)")).toHaveValue("focus timer");
  });

  test.describe("confirming where a save tracks", () => {
    const TRACKED_ALPHA_BETA = {
      ...MX_SEED,
      fields: { "es-MX": ["alpha", "beta"] },
      tracked: { us: ["alpha", "beta"], mx: ["alpha", "beta"] },
    } satisfies LocalizationSeed;

    const dialog = (page: Page) => page.getByRole("dialog");

    async function putOf(
      page: Page,
      localization: string,
      act: () => Promise<void>,
    ): Promise<unknown> {
      const put = page.waitForRequest(
        (request) =>
          request.method() === "PUT" &&
          request.url().endsWith(`/keyword-fields/${localization}`),
      );
      await act();
      return (await put).postDataJSON();
    }

    async function openSpanishDialog(page: Page, text: string) {
      await page.goto(`${LOCALES_METADATA}?fieldLocale=es-MX`);
      await typeInto(editor(page, "Spanish (Mexico)"), text);
      await save(page).click();
      await expect(dialog(page)).toBeVisible();
    }

    test("saves straight away when nothing new would be tracked", async ({
      page,
    }) => {
      await seedLocalizations(page.request, LOCALES_APP, TRACKED_ALPHA_BETA);
      await page.goto(`${LOCALES_METADATA}?fieldLocale=es-MX`);
      await typeInto(editor(page, "Spanish (Mexico)"), "beta,alpha");

      const checked = page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          request.url().endsWith("/keyword-fields/es-MX/preview"),
      );
      const body = await putOf(page, "es-MX", async () => {
        await save(page).click();
        await checked;
      });

      expect(body).toEqual({ text: "beta,alpha", trackIn: ["us", "mx"] });
      await expect(dialog(page)).toHaveCount(0);
      await expect(
        page.getByText("Saved the Spanish (Mexico) keyword field"),
      ).toBeVisible();
    });

    test("asks where to track new phrases", async ({ page }) => {
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      await openSpanishDialog(page, "temporizador, enfoque");

      const modal = page.getByRole("dialog", {
        name: "Save the Spanish (Mexico) keyword field",
      });
      await expect(modal).toHaveAccessibleDescription(
        "Choose the markets that should track its phrases. Every market on its list reads the field either way.",
      );
      await expect(
        modal.getByText("2 new phrases: temporizador, enfoque"),
      ).toBeVisible();
      await expect(
        modal.getByRole("checkbox", { name: "United States" }),
      ).toBeChecked();
      await expect(
        modal.getByRole("checkbox", { name: "Mexico" }),
      ).toBeChecked();
      await expect(modal.getByText("2 new", { exact: true })).toHaveCount(2);
      await expect(modal.getByText("Also", { exact: true })).toBeVisible();
      await expect(modal.getByText("Default", { exact: true })).toBeVisible();
      await expect(
        modal.getByText(
          "Adds 4 keyword markets and about 4 store requests a day.",
        ),
      ).toBeVisible();
      await expect(modal.getByRole("button", { name: "Cancel" })).toBeVisible();
      await expect(
        modal.getByRole("button", { name: "Save and track" }),
      ).toBeVisible();
    });

    test("sums the cost of the ticked markets and sends them as trackIn", async ({
      page,
    }) => {
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      await openSpanishDialog(page, "temporizador, enfoque");

      await dialog(page)
        .getByRole("checkbox", { name: "United States" })
        .click();
      await expect(
        dialog(page).getByText(
          "Adds 2 keyword markets and about 2 store requests a day.",
        ),
      ).toBeVisible();
      const body = await putOf(page, "es-MX", () =>
        dialog(page).getByRole("button", { name: "Save and track" }).click(),
      );

      expect(body).toEqual({ text: "temporizador, enfoque", trackIn: ["mx"] });
      await expect(page.getByText("2 phrases tracked in Mexico")).toBeVisible();
      await expect(page.getByText("Queued · scoring")).toBeVisible();
    });

    test("saves without tracking when no market is ticked", async ({
      page,
    }) => {
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      await openSpanishDialog(page, "temporizador, enfoque");

      await dialog(page)
        .getByRole("checkbox", { name: "United States" })
        .click();
      await dialog(page).getByRole("checkbox", { name: "Mexico" }).click();
      await expect(dialog(page).getByText("Tracks nothing new.")).toBeVisible();
      const body = await putOf(page, "es-MX", () =>
        dialog(page).getByRole("button", { name: "Save", exact: true }).click(),
      );

      expect(body).toMatchObject({ trackIn: [] });
      await expect(
        page.getByText("Its phrases are not tracked in any market"),
      ).toBeVisible();
      await expect(page.getByText("Queued · scoring")).toHaveCount(0);
    });

    test("names the phrases that leave the field", async ({ page }) => {
      await seedLocalizations(page.request, LOCALES_APP, TRACKED_ALPHA_BETA);
      await openSpanishDialog(page, "alpha");

      await expect(
        dialog(page).getByText(
          "1 phrase leaves the field and stops being tracked as a keyword field phrase in United States and Mexico",
        ),
      ).toBeVisible();
      await expect(dialog(page).getByText(/new phrase/)).toHaveCount(0);
      await expect(dialog(page).getByText("Tracks nothing new.")).toBeVisible();
    });

    test("warns when the plan cannot hold the new keyword markets", async ({
      context,
      page,
    }) => {
      await seedCookies(context, { [QUOTA_COOKIE]: "3" });
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      await openSpanishDialog(page, "temporizador, enfoque");

      await expect(
        dialog(page).getByText("4 of 3 keyword markets after saving."),
      ).toBeVisible();
      await expect(
        dialog(page).getByRole("link", { name: "See plans" }),
      ).toHaveAttribute("href", "/upgrade");
      await expect(
        dialog(page).getByRole("button", { name: "Save and track" }),
      ).toBeDisabled();

      await dialog(page)
        .getByRole("checkbox", { name: "United States" })
        .click();
      await expect(
        dialog(page).getByText("2 of 3 keyword markets after saving."),
      ).toBeVisible();
      await expect(
        dialog(page).getByRole("link", { name: "See plans" }),
      ).toHaveCount(0);
      await expect(
        dialog(page).getByRole("button", { name: "Save and track" }),
      ).toBeEnabled();
    });

    test("shows the plan quota without a warning while the save fits", async ({
      context,
      page,
    }) => {
      await seedCookies(context, { [QUOTA_COOKIE]: "10" });
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      await openSpanishDialog(page, "temporizador, enfoque");

      await expect(
        dialog(page).getByText("4 of 10 keyword markets after saving."),
      ).toBeVisible();
      await expect(
        dialog(page).getByRole("link", { name: "See plans" }),
      ).toHaveCount(0);
      await expect(
        dialog(page).getByRole("button", { name: "Save and track" }),
      ).toBeEnabled();
    });

    test("cannot be closed while the save runs", async ({ page }) => {
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      let release!: () => void;
      const held = new Promise<void>((resolve) => (release = resolve));
      await page.route("**/keyword-fields/es-MX", async (route) => {
        await held;
        await route.continue();
      });
      await openSpanishDialog(page, "temporizador");

      await dialog(page)
        .getByRole("button", { name: "Save and track" })
        .click();
      const cancel = dialog(page).getByRole("button", { name: "Cancel" });
      await expect(cancel).toBeDisabled();
      await page.keyboard.press("Escape");
      await page.mouse.click(5, 5);
      await expect(dialog(page)).toBeVisible();
      await expect(cancel).toBeDisabled();

      release();
      await expect(dialog(page)).toHaveCount(0);
      await expect(
        page.getByText("Saved the Spanish (Mexico) keyword field"),
      ).toBeVisible();
    });

    test("keeps the dialog open and shows the refusal when the plan limit was reached meanwhile", async ({
      context,
      page,
    }) => {
      await seedCookies(context, { e2e_field_race: "1" });
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      await openSpanishDialog(page, "temporizador");

      await dialog(page)
        .getByRole("button", { name: "Save and track" })
        .click();

      await expect(
        dialog(page).getByText(
          "keywordMarkets limit reached: 998 of 1000 used on the indie plan, 5 more requested",
        ),
      ).toBeVisible();
      await expect(
        page.getByText("Saved the Spanish (Mexico) keyword field"),
      ).toHaveCount(0);
      await dialog(page).getByRole("button", { name: "Cancel" }).click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(editor(page, "Spanish (Mexico)")).toHaveValue(
        "temporizador",
      );
    });

    test("writes nothing until the dialog is confirmed", async ({ page }) => {
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      await openSpanishDialog(page, "temporizador");

      const spanishOf = async () =>
        (
          (await (
            await page.request.get(
              `${MOCK_API_URL}/apps/${LOCALES_APP}/localizations`,
            )
          ).json()) as AppLocalizationsResult
        ).localizations.find((item) => item.localization === "es-MX");

      expect(await spanishOf()).toMatchObject({ phrases: [] });
      await dialog(page).getByRole("button", { name: "Cancel" }).click();
      await expect(dialog(page)).toHaveCount(0);
      expect(await spanishOf()).toMatchObject({ phrases: [] });
    });

    test("sends one save for a double click", async ({ page }) => {
      await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
      await openSpanishDialog(page, "temporizador");
      let puts = 0;
      page.on("request", (request) => {
        if (
          request.method() === "PUT" &&
          request.url().endsWith("/keyword-fields/es-MX")
        ) {
          puts += 1;
        }
      });

      await dialog(page)
        .getByRole("button", { name: "Save and track" })
        .dblclick();

      await expect(
        page.getByText("Saved the Spanish (Mexico) keyword field"),
      ).toBeVisible();
      expect(puts).toBe(1);
    });

    test("tracks a field only in the markets that were ticked", async ({
      page,
    }) => {
      await seedLocalizations(page.request, LOCALES_APP, {
        markets: ["de", "at"],
        shipped: [{ localization: "de", origin: "manual" }],
      });
      await page.goto(`${LOCALES_METADATA}?fieldLocale=de`);
      await typeInto(editor(page, "German"), "gewohnheit");
      await save(page).click();

      await expect(
        dialog(page).getByRole("checkbox", { name: "Austria" }),
      ).toBeVisible();
      await expect(
        dialog(page).getByRole("checkbox", { name: "Germany" }),
      ).toBeVisible();
      await expect(
        dialog(page).getByRole("checkbox", { name: "United States" }),
      ).toHaveCount(0);
      await expect(
        dialog(page).getByText("Default", { exact: true }),
      ).toHaveCount(2);
      await dialog(page).getByRole("checkbox", { name: "Austria" }).click();
      const body = await putOf(page, "de", () =>
        dialog(page).getByRole("button", { name: "Save and track" }).click(),
      );

      expect(body).toMatchObject({ trackIn: ["de"] });
      await expect(page.getByText("1 phrase tracked in Germany")).toBeVisible();
    });

    for (const viewport of [
      { width: 1280, height: 560 },
      { width: 375, height: 480 },
    ]) {
      test(`keeps the save dialog inside a short viewport at ${viewport.width}x${viewport.height}`, async ({
        page,
      }) => {
        await seedLocalizations(page.request, LOCALES_APP, MX_SEED);
        await page.setViewportSize(viewport);
        await openSpanishDialog(page, "temporizador, enfoque");

        const modal = dialog(page);
        await modal.evaluate((node) =>
          Promise.all(
            node.getAnimations().map((animation) => animation.finished),
          ),
        );
        await expectFitsViewport(page, modal);
        await expect(
          modal.getByRole("button", { name: "Save and track" }),
        ).toBeInViewport();
      });
    }
  });
});
