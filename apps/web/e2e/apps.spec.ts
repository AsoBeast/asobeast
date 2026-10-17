import type { Page } from "@playwright/test";
import { STORE_SEARCH_QUERY_MAX_LENGTH } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import { APP_1_SUMMARY, IMPORTED_APP, STORE_SEARCH } from "./fixtures.mts";
import { startedSetup, storedSetup } from "./setup-session.mts";

const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

test("importing an app posts to the api and shows the new app", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Import app" }).focus();
  await page.keyboard.press("Enter");
  await page
    .getByLabel("App name or store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
  await expect(page).toHaveURL("/apps/app-new/setup");
  await expect(
    page.getByRole("heading", { name: /^Set up Imported App/ }),
  ).toBeVisible();
  await expect(page.getByText("United States (US)")).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: IMPORTED_APP.name ?? "" }),
  ).toBeVisible();
});

for (const input of [
  "com.duolingo",
  "570060128",
  "apps.apple.com/us/app/focus-timer/id123456789",
]) {
  test(`the import dialog submits ${input}`, async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Import app" }).click();
    await page.getByLabel("App name or store URL").fill(input);
    await page.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
  });
}

test("the import dialog refuses an apple page that is not a listing", async ({
  page,
}) => {
  const developerPage = "https://apps.apple.com/us/developer/focus/id123456789";
  const imports: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/backend/apps")
    ) {
      imports.push(request.url());
    }
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Import app" }).click();
  await page.getByLabel("App name or store URL").fill(developerPage);
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(
    page.getByText(`Unrecognized store URL or id: ${developerPage}`),
  ).toBeVisible();
  expect(imports).toEqual([]);
});

const DEVELOPER_PAGE = "https://apps.apple.com/us/developer/focus/id123456789";
const FOCUS_TIMER_URL = "https://apps.apple.com/us/app/focus-timer/id123456789";

async function refuseDeveloperPage(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Import app" }).click();
  const field = page.getByLabel("App name or store URL");
  await field.fill(DEVELOPER_PAGE);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator("#import-url-error")).toHaveText(
    `Unrecognized store URL or id: ${DEVELOPER_PAGE}`,
  );
  await expect(field).toHaveAttribute("aria-invalid", "true");
  return field;
}

test("the import dialog drops a refusal as soon as the value changes", async ({
  page,
}) => {
  const field = await refuseDeveloperPage(page);

  await field.fill("Duolingo");

  await expect(page.locator("#import-url-error")).toHaveCount(0);
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await expect(field).toBeFocused();

  await field.fill(DEVELOPER_PAGE);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator("#import-url-error")).toBeVisible();

  await field.fill(FOCUS_TIMER_URL);

  await expect(page.locator("#import-url-error")).toHaveCount(0);
  await expect(field).toHaveAttribute("aria-invalid", "false");
});

test("the import dialog drops a refusal when the store changes", async ({
  page,
}) => {
  await refuseDeveloperPage(page);

  await page.getByRole("tab", { name: "Google Play" }).click();

  await expect(page.locator("#import-url-error")).toHaveCount(0);
});

test("the import dialog drops a storefront refusal when the storefront changes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Import app" }).click();
  const field = page.getByLabel("App name or store URL");
  await field.fill(FOCUS_TIMER_URL);
  await page.getByRole("combobox", { name: "Home storefront" }).click();
  await page.getByRole("option", { name: "Other…" }).click();
  await page.getByLabel("Storefront country code").fill("zz");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator("#import-url-error")).toHaveText(
    "zz is not an App Store storefront",
  );

  await page.getByLabel("Storefront country code").fill("us");

  await expect(page.locator("#import-url-error")).toHaveCount(0);
  await expect(field).toHaveAttribute("aria-invalid", "false");
});

test.describe("a fast double click", () => {
  const countRequests = (page: Page, method: string, path: RegExp) => {
    const seen: string[] = [];
    page.on("request", (request) => {
      if (request.method() === method && path.test(request.url())) {
        seen.push(request.url());
      }
    });
    return seen;
  };

  test("on Import sends one import", async ({ page }) => {
    const imports = countRequests(page, "POST", /\/api\/backend\/apps$/);
    await page.goto("/");

    await page.getByRole("button", { name: "Import app" }).click();
    await page
      .getByLabel("App name or store URL")
      .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
    await page.getByRole("button", { name: "Import", exact: true }).dblclick();

    await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
    expect(imports).toHaveLength(1);
  });

  test("still lets Import run again after the dialog closed mid request", async ({
    page,
  }) => {
    let held = false;
    await page.route("**/api/backend/apps", async (route) => {
      if (route.request().method() !== "POST" || held) {
        return route.fallback();
      }
      held = true;
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 503, json: { statusCode: 503 } });
    });
    const imports = countRequests(page, "POST", /\/api\/backend\/apps$/);
    await page.goto("/");

    const startImport = async () => {
      await page.getByRole("button", { name: "Import app" }).click();
      await page
        .getByLabel("App name or store URL")
        .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
      await page.getByRole("button", { name: "Import", exact: true }).click();
    };

    const firstImport = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/backend/apps"),
    );
    await startImport();
    await page.keyboard.press("Escape");
    await firstImport;
    await startImport();

    await expect.poll(() => imports.length).toBe(2);
  });

  test("on Delete app sends one delete", async ({ page }) => {
    const deletes = countRequests(
      page,
      "DELETE",
      /\/api\/backend\/apps\/[^/]+$/,
    );
    await page.goto("/");

    await page.getByRole("button", { name: "App actions" }).first().click();
    await page.getByRole("menuitem", { name: "Delete app" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete app" })
      .dblclick();

    await expect(page.getByText(/^Deleted /).first()).toBeVisible();
    expect(deletes).toHaveLength(1);
    await expect(page.getByText(/^Could not delete /)).toHaveCount(0);
  });
});

test.describe("importing by name", () => {
  const recordSearches = (page: Page) => {
    const searches: URL[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith("/api/backend/store/search")) {
        searches.push(url);
      }
    });
    return searches;
  };

  const recordImports = (page: Page) => {
    const bodies: unknown[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/backend/apps")
      ) {
        bodies.push(request.postDataJSON());
      }
    });
    return bodies;
  };

  const failTerm = async (page: Page, failing: string, status = 502) => {
    const terms: string[] = [];
    await page.route("**/api/backend/store/search*", (route) => {
      const q = new URL(route.request().url()).searchParams.get("q") ?? "";
      terms.push(q);
      return q === failing
        ? route.fulfill({
            status,
            json: {
              statusCode: status,
              error: "Error",
              message: "The store did not answer.",
              path: "/store/search",
              timestamp: new Date().toISOString(),
            },
          })
        : route.fallback();
    });
    return terms;
  };

  const searchAfterFailure = async (
    page: Page,
    clear: (field: ReturnType<Page["getByLabel"]>) => Promise<void>,
  ) => {
    const terms = await failTerm(page, "first term");
    const dialog = await openDialog(page);
    const field = dialog.getByLabel("App name or store URL");
    await field.pressSequentially("first term", { delay: 20 });
    await expect(dialog.getByRole("alert")).toHaveText(
      "The store did not answer. Try again in a moment.",
    );

    await clear(field);
    await field.pressSequentially("focus", { delay: 20 });

    await expect(
      dialog.getByRole("list", {
        name: "Results from App Store in United States",
      }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    return terms;
  };

  const openDialog = async (page: Page) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Import app" }).click();
    return page.getByRole("dialog", { name: "Import an app" });
  };

  test("a name search lists results and imports the picked one", async ({
    page,
  }) => {
    const imports = recordImports(page);
    const dialog = await openDialog(page);

    await dialog.getByLabel("App name or store URL").fill("focus");

    const results = dialog.getByRole("list", {
      name: "Results from App Store in United States",
    });
    const focusTimer = results.getByRole("button", { name: /Focus Timer/ });
    await expect(focusTimer).toContainText("Acme");
    await expect(focusTimer).toContainText("4.6 · 1,200 ratings");
    await expect(focusTimer.locator("img")).toHaveCount(1);
    await expect(results.getByRole("button")).toHaveText([
      /Focus Timer/,
      /Focus Keeper/,
      /Focused Study/,
    ]);

    await focusTimer.click();

    await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
    await expect(page).toHaveURL("/apps/app-new/setup");
    expect(imports).toEqual([{ url: "123456789", country: "us" }]);
  });

  test("a name search follows the store tabs and the storefront", async ({
    page,
  }) => {
    const searches = recordSearches(page);
    const dialog = await openDialog(page);

    await dialog.getByRole("tab", { name: "Google Play" }).click();
    await dialog.getByRole("combobox", { name: "Home storefront" }).click();
    await page.getByRole("option", { name: "DE · Germany" }).click();
    await dialog.getByLabel("App name or store URL").fill("fok");

    const results = dialog.getByRole("list", {
      name: "Results from Google Play in Germany",
    });
    await expect(results.getByRole("button")).toHaveCount(
      STORE_SEARCH.GOOGLE_PLAY.length,
    );
    const last = searches.at(-1);
    expect(last?.searchParams.get("store")).toBe("GOOGLE_PLAY");
    expect(last?.searchParams.get("country")).toBe("de");
    expect(last?.searchParams.get("q")).toBe("fok");
  });

  test("a spent allowance is shown in place of results", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "e2e_store_search_spent",
        value: "1",
        url: "http://localhost:3000",
      },
    ]);
    const dialog = await openDialog(page);

    await dialog.getByLabel("App name or store URL").fill("focus");

    await expect(dialog.getByRole("alert")).toHaveText(
      /Store lookup limit reached/,
    );
    await expect(dialog.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("a store that does not answer says so", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "e2e_store_search_fail",
        value: "1",
        url: "http://localhost:3000",
      },
    ]);
    const dialog = await openDialog(page);

    await dialog.getByLabel("App name or store URL").fill("focus");

    await expect(dialog.getByRole("alert")).toHaveText(
      "The store did not answer. Try again in a moment.",
    );
  });

  test("does not resend a failed term after the field is cleared and retyped", async ({
    page,
  }) => {
    const terms = await searchAfterFailure(page, (field) => field.fill(""));

    expect(terms).toEqual(["first term", "focus"]);
  });

  test("does not resend a failed term after select all and overtype", async ({
    page,
  }) => {
    const terms = await searchAfterFailure(page, (field) =>
      field.press("ControlOrMeta+a"),
    );

    expect(terms).toEqual(["first term", "focus"]);
  });

  test("still retries a failed term when Retry is pressed", async ({
    page,
  }) => {
    const terms = await failTerm(page, "focus");
    const dialog = await openDialog(page);
    await dialog
      .getByLabel("App name or store URL")
      .pressSequentially("focus", { delay: 20 });
    await expect(dialog.getByRole("alert")).toBeVisible();

    await dialog.getByRole("button", { name: "Retry" }).click();

    await expect.poll(() => terms).toEqual(["focus", "focus"]);
  });

  test("a search the api refuses with 400 says so and offers no Retry", async ({
    page,
  }) => {
    const terms = await failTerm(page, "focus", 400);
    const dialog = await openDialog(page);

    await dialog
      .getByLabel("App name or store URL")
      .pressSequentially("focus", { delay: 20 });

    await expect(dialog.getByRole("alert")).toHaveText(
      "This name cannot be searched. Change it and try again.",
    );
    await expect(dialog.getByRole("button", { name: "Retry" })).toHaveCount(0);
    expect(terms).toEqual(["focus"]);
  });

  test("a name the store does not know says so", async ({ page }) => {
    const dialog = await openDialog(page);

    await dialog.getByLabel("App name or store URL").fill("zzz");

    await expect(
      dialog.getByText("No listing named “zzz” in United States."),
    ).toBeVisible();
  });

  test("typing a url never searches", async ({ page }) => {
    const searches = recordSearches(page);
    const dialog = await openDialog(page);

    await dialog
      .getByLabel("App name or store URL")
      .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
    await dialog.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
    expect(searches).toEqual([]);
  });

  test("enter imports the only result", async ({ page }) => {
    const imports = recordImports(page);
    const dialog = await openDialog(page);

    const field = dialog.getByLabel("App name or store URL");
    await field.fill("focused");
    await expect(
      dialog.getByRole("button", { name: /Focused Study/ }),
    ).toBeVisible();
    await field.press("Enter");

    await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
    expect(imports).toEqual([{ url: "555000333", country: "us" }]);
  });

  test("a name that starts with a digit keeps the chosen store and storefront", async ({
    page,
  }) => {
    const dialog = await openDialog(page);

    await dialog.getByRole("tab", { name: "Google Play" }).click();
    await dialog.getByRole("combobox", { name: "Home storefront" }).click();
    await page.getByRole("option", { name: "DE · Germany" }).click();
    await dialog
      .getByLabel("App name or store URL")
      .pressSequentially("2 Player");

    await expect(
      dialog.getByText("No listing named “2 Player” in Germany."),
    ).toBeVisible();
    await expect(
      dialog.getByRole("tab", { name: "Google Play" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("a name with a colon or a slash is searched rather than refused", async ({
    page,
  }) => {
    const searches = recordSearches(page);
    const dialog = await openDialog(page);

    await dialog.getByLabel("App name or store URL").fill("Focus: Deep/Work");

    await expect(
      dialog.getByText("No listing named “Focus: Deep/Work” in United States."),
    ).toBeVisible();
    expect(searches.at(-1)?.searchParams.get("q")).toBe("Focus: Deep/Work");
  });

  test("enter on a one letter name asks for more", async ({ page }) => {
    const imports = recordImports(page);
    const dialog = await openDialog(page);

    const field = dialog.getByLabel("App name or store URL");
    await field.fill("f");
    await field.press("Enter");

    await expect(
      dialog.getByText("Type at least 2 characters to search."),
    ).toBeVisible();
    expect(imports).toEqual([]);
  });

  const TOO_LONG = "a".repeat(STORE_SEARCH_QUERY_MAX_LENGTH + 1);
  const TOO_LONG_TEXT = `Search with up to ${STORE_SEARCH_QUERY_MAX_LENGTH} characters. This name has ${TOO_LONG.length}.`;

  test("a name over the limit is explained and never searched", async ({
    page,
  }) => {
    const searches = recordSearches(page);
    const dialog = await openDialog(page);
    const field = dialog.getByLabel("App name or store URL");

    await field.fill(TOO_LONG);

    await expect(dialog.locator("#import-url-error")).toHaveText(TOO_LONG_TEXT);
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("button", { name: "Retry" })).toHaveCount(0);
    await page.waitForTimeout(700);
    expect(searches).toEqual([]);
  });

  test("a name of exactly the limit is searched", async ({ page }) => {
    const searches = recordSearches(page);
    const dialog = await openDialog(page);
    const field = dialog.getByLabel("App name or store URL");

    await field.fill("a".repeat(STORE_SEARCH_QUERY_MAX_LENGTH));

    await expect(dialog.getByText(/^No listing named/)).toBeVisible();
    await expect(field).toHaveAttribute("aria-invalid", "false");
    expect(searches.map((url) => url.searchParams.get("q")?.length)).toEqual([
      STORE_SEARCH_QUERY_MAX_LENGTH,
    ]);
  });

  test("shortening a name that was too long drops the message and searches", async ({
    page,
  }) => {
    const dialog = await openDialog(page);
    const field = dialog.getByLabel("App name or store URL");
    await field.fill(TOO_LONG);
    await expect(dialog.locator("#import-url-error")).toBeVisible();

    await field.fill("focus");

    await expect(dialog.locator("#import-url-error")).toHaveCount(0);
    await expect(field).toHaveAttribute("aria-invalid", "false");
    await expect(
      dialog.getByRole("button", { name: /Focus Timer/ }),
    ).toBeVisible();
  });

  test("enter on a name over the limit explains and imports nothing", async ({
    page,
  }) => {
    const imports = recordImports(page);
    const dialog = await openDialog(page);
    const field = dialog.getByLabel("App name or store URL");

    await field.fill(`${TOO_LONG}a`);
    await field.press("Enter");

    await expect(dialog.locator("#import-url-error")).toHaveText(
      `Search with up to ${STORE_SEARCH_QUERY_MAX_LENGTH} characters. This name has ${TOO_LONG.length + 1}.`,
    );
    expect(imports).toEqual([]);

    await field.press("Backspace");

    await expect(dialog.locator("#import-url-error")).toHaveText(TOO_LONG_TEXT);
  });

  test("emoji count once, as the api counts them", async ({ page }) => {
    const searches = recordSearches(page);
    const dialog = await openDialog(page);
    const field = dialog.getByLabel("App name or store URL");

    await field.fill("😀".repeat(STORE_SEARCH_QUERY_MAX_LENGTH));
    await expect(dialog.getByText(/^No listing named/)).toBeVisible();
    await field.fill("😀".repeat(STORE_SEARCH_QUERY_MAX_LENGTH + 1));

    await expect(dialog.locator("#import-url-error")).toContainText(
      "This name has 81.",
    );
    expect(searches).toHaveLength(1);
  });

  test("a long store url is not a name and still imports", async ({ page }) => {
    const searches = recordSearches(page);
    const imports = recordImports(page);
    const dialog = await openDialog(page);

    await dialog
      .getByLabel("App name or store URL")
      .fill(
        `https://apps.apple.com/us/app/focus-timer/id123456789?utm_source=${"x".repeat(120)}`,
      );
    await dialog.getByRole("button", { name: "Import", exact: true }).click();

    await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
    expect(searches).toEqual([]);
    expect(imports).toHaveLength(1);
  });

  test("enter moves to the results when there is a choice", async ({
    page,
  }) => {
    const imports = recordImports(page);
    const dialog = await openDialog(page);

    const field = dialog.getByLabel("App name or store URL");
    await field.fill("focus");
    await expect(
      dialog.getByRole("button", { name: /Focus Keeper/ }),
    ).toBeVisible();
    await field.press("Enter");

    await expect(
      dialog.getByRole("button", { name: /Focus Timer/ }),
    ).toBeFocused();
    expect(imports).toEqual([]);
  });
});

const importFocusTimer = async (page: Page) => {
  await page.getByRole("button", { name: "Import app" }).click();
  await page
    .getByLabel("App name or store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).click();
};

test("an import always opens the setup of the imported app and keeps its progress", async ({
  page,
}) => {
  await page.goto("/");
  await importFocusTimer(page);

  await expect(page).toHaveURL("/apps/app-new/setup");
  await page.getByRole("button", { name: "Countries reviewed" }).click();
  await expect
    .poll(
      async () =>
        (await storedSetup(page.context(), "app-new")).countriesReviewed,
    )
    .toBe(true);

  await page.goto("/");
  await importFocusTimer(page);

  await expect(page).toHaveURL("/apps/app-new/setup");
  await expect(
    page.getByRole("heading", { name: /^Set up Imported App · 1 of 3/ }),
  ).toBeVisible();
});

test("a first import replaces the first run screen without a reload", async ({
  page,
}) => {
  await page
    .context()
    .addCookies([
      { name: "portfolio_empty", value: "1", url: "http://localhost:3000" },
    ]);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Track your first app" }),
  ).toBeVisible();
  await page.context().clearCookies({ name: "portfolio_empty" });

  await page.getByRole("button", { name: "Import app" }).click();
  await page
    .getByLabel("App name or store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
  await expect(page).toHaveURL("/apps/app-new/setup");
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("link", { name: IMPORTED_APP.name ?? "" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Track your first app" }),
  ).toHaveCount(0);
});

test("an import whose account cannot be loaded still opens the setup page", async ({
  page,
}) => {
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill({ status: 503, json: { statusCode: 503 } }),
  );
  await page.goto("/");
  await importFocusTimer(page);

  await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
  await expect(page).toHaveURL("/apps/app-new/setup");
});

test("deleting the last app returns the dashboard to the first run screen", async ({
  page,
}) => {
  let deleted = false;
  await page.route(/\/api\/backend\/apps\/[^/]+$/, async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deleted = true;
    await route.fulfill({ status: 204 });
  });
  await page.route("**/api/backend/portfolio", async (route) => {
    if (!deleted) return route.fallback();
    const response = await route.fetch();
    const portfolio = await response.json();
    await route.fulfill({
      response,
      json: { ...portfolio, apps: [], groups: [] },
    });
  });
  await page.goto("/");

  await page.getByRole("button", { name: "App actions" }).first().click();
  await page.getByRole("menuitem", { name: "Delete app" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete app" })
    .click();

  await expect(
    page.getByRole("heading", { name: "Track your first app" }),
  ).toBeVisible();
});

test("a second import keeps the setup of the first app in progress", async ({
  page,
}) => {
  await startedSetup(page.context(), "app-1");
  await page.goto("/");
  await importFocusTimer(page);

  await expect(page).toHaveURL("/apps/app-new/setup");
  await expect(
    page.getByRole("heading", { name: /^Set up Imported App/ }),
  ).toBeVisible();
  expect((await storedSetup(page.context(), "app-1")).status).toBe(
    "in_progress",
  );

  await page.goto("/apps/app-1/setup");
  await expect(
    page.getByRole("heading", { name: /^Set up Focus Timer/ }),
  ).toBeVisible();
});

test("pending setup can be resumed or dismissed from the dashboard", async ({
  page,
}) => {
  await startedSetup(page.context(), "app-2");
  await startedSetup(page.context(), "app-1");
  const patches: unknown[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith("/api/backend/apps/app-1/setup")
    ) {
      patches.push(request.postDataJSON());
    }
  });
  await page.goto("/");

  const banner = page.getByRole("status").filter({ hasText: /^Set up / });
  await expect(banner.getByText(/^Set up Focus Timer/)).toHaveText(
    "Set up Focus Timer · 1 of 3 · next: track keywords · and 1 more app",
  );
  await expect(
    banner.getByRole("progressbar", { name: "Setup progress" }),
  ).toHaveAttribute("aria-valuetext", "1 of 3 steps");
  await expect(banner).not.toContainText("browser");
  await page.getByRole("link", { name: "Resume setup" }).click();
  await expect(page).toHaveURL("/apps/app-1/setup");

  await page.goto("/");
  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner.getByText(/^Set up Habit Tracker/)).toHaveText(
    "Set up Habit Tracker · 0 of 3 · next: pick competitors",
  );
  expect(patches).toEqual([{ status: "dismissed" }]);
  await page.reload();
  await expect(page.getByText(/^Set up Focus Timer/)).toBeHidden();
  await expect(banner.getByText(/^Set up Habit Tracker/)).toBeVisible();
});

test("an existing portfolio is not enrolled without an import", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Focus Timer" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Resume setup" })).toHaveCount(0);
});

test("app overview renders summary numbers and a utc refresh date", async ({
  page,
}) => {
  await page.goto("/apps/app-1");

  await expect(page.getByText("+5 7d")).toHaveClass(/text-signal-up/);
  await expect(page.getByText("-3 30d")).toHaveClass(/text-signal-down/);
  await expect(page.getByText("3 in top 10")).toBeVisible();

  await expect(page.getByText("Where your keywords rank")).toBeVisible();

  await expect(page.getByText("Keyword movers")).toBeVisible();
  await expect(page.getByRole("link", { name: /focus timer/ })).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: /focus timer/ })
      .locator("[data-grade]", { hasText: "Position 3, strong" }),
  ).toHaveAttribute("data-grade", "strong");
  await expect(
    page
      .getByRole("link", { name: /pomodoro/ })
      .locator("[data-grade]", { hasText: "Position 12, weak" }),
  ).toHaveAttribute("data-grade", "weak");

  await expect(page.getByText("Metadata coverage")).toBeVisible();
  await expect(page.getByText("productivity app")).toBeVisible();

  const refreshDate = utcDateFormatter.format(
    new Date(APP_1_SUMMARY.lastRefreshAt ?? ""),
  );
  await expect(page.getByText("Last refresh")).toBeVisible();
  await expect(page.getByText(refreshDate, { exact: true })).toBeVisible();
});

test("an app that iPhone search never lists carries a notice on every page", async ({
  page,
}) => {
  const notice = page
    .getByRole("note")
    .filter({ hasText: "not available on iPhone" });

  await page.goto("/apps/app-ipad-only");
  await expect(notice).toBeVisible();

  await page.goto("/apps/app-ipad-only/keywords");
  await expect(notice).toBeVisible();
});

test("an app that iPhone search lists carries no such notice", async ({
  page,
}) => {
  await page.goto("/apps/app-1");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("note").filter({ hasText: "not available on iPhone" }),
  ).toHaveCount(0);
});

test("an api error renders the error boundary with a retry control", async ({
  page,
}) => {
  await page.goto("/apps/err-app");

  const boundary = page.getByRole("main").getByRole("alert");
  await expect(boundary).toBeVisible();
  await expect(
    boundary.getByRole("button", { name: "Try again" }),
  ).toBeVisible();
});

test("the error boundary recovers once retry is pressed and the api answers", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-fail-app",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/apps/app-1");

  const boundary = page.getByRole("main").getByRole("alert");
  await expect(boundary).toBeVisible();

  await page.context().clearCookies({ name: "e2e-fail-app" });
  await boundary.getByRole("button", { name: "Try again" }).click();

  await expect(boundary).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("an error state stays quiet when no status page is configured", async ({
  page,
}) => {
  await page.goto("/apps/err-app");

  const boundary = page.getByRole("main").getByRole("alert");
  await expect(boundary).toBeVisible();
  await expect(
    boundary.getByRole("link", { name: "check the status page" }),
  ).toHaveCount(0);
});

test("an error state points at the status page once one is configured", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        statusPageUrl: "https://status.example.com/",
      }),
    }),
  );

  await page.goto("/apps/err-app");

  const boundary = page.getByRole("main").getByRole("alert");
  await expect(
    boundary.getByRole("link", { name: "check the status page" }),
  ).toHaveAttribute("href", "https://status.example.com/");
});

test("an unknown app renders the not-found boundary", async ({ page }) => {
  await page.goto("/apps/does-not-exist");

  const main = page.getByRole("main");
  await expect(main.getByText("Page not found")).toBeVisible();
  await expect(
    main.getByText("There is nothing at this address."),
  ).toBeVisible();
});
