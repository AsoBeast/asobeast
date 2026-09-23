import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_1_SUMMARY, IMPORTED_APP } from "./fixtures.mts";
import {
  beginOnboarding,
  completeOnboarding,
  NOT_STARTED_ONBOARDING,
  ONBOARDING_STORAGE_KEY,
  setOnboardingAcknowledgement,
} from "../src/lib/onboarding";

function finishedSetup() {
  let state = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us");
  state = setOnboardingAcknowledgement(state, "noCompetitors", true);
  state = setOnboardingAcknowledgement(state, "keywordsConfirmed", true);
  state = setOnboardingAcknowledgement(state, "capacityReviewed", true);
  state = setOnboardingAcknowledgement(state, "alertsSkipped", true);
  return completeOnboarding(state, 0, 0);
}

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
    .getByLabel("Store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
  await expect(page).toHaveURL("/apps/app-new/setup");
  await expect(
    page.getByRole("heading", { name: "Set up Imported App" }),
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
    await page.getByLabel("Store URL").fill(input);
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
  await page.getByLabel("Store URL").fill(developerPage);
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(
    page.getByText(`Unrecognized store URL or id: ${developerPage}`),
  ).toBeVisible();
  expect(imports).toEqual([]);
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
      .getByLabel("Store URL")
      .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
    await page.getByRole("button", { name: "Import", exact: true }).dblclick();

    await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
    expect(imports).toHaveLength(1);
  });

  test("still lets Import run again after the dialog closed mid request", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: ONBOARDING_STORAGE_KEY, value: JSON.stringify(finishedSetup()) },
    );
    await page.route("**/api/backend/apps", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.fallback();
    });
    const imports = countRequests(page, "POST", /\/api\/backend\/apps$/);
    await page.goto("/");

    const startImport = async () => {
      await page.getByRole("button", { name: "Import app" }).click();
      await page
        .getByLabel("Store URL")
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

test("finished setup suppresses redirects after later imports", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: ONBOARDING_STORAGE_KEY, value: JSON.stringify(finishedSetup()) },
  );
  await page.goto("/");

  await page.getByRole("button", { name: "Import app" }).click();
  await page
    .getByLabel("Store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
});

test("pending setup can be resumed or dismissed from the dashboard", async ({
  page,
}) => {
  const state = beginOnboarding(NOT_STARTED_ONBOARDING, "app-1", "us");
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    { key: ONBOARDING_STORAGE_KEY, value: JSON.stringify(state) },
  );
  await page.goto("/");

  await expect(page.getByText("Finish setting up Focus Timer.")).toBeVisible();
  await page.getByRole("link", { name: "Resume setup" }).click();
  await expect(page).toHaveURL("/apps/app-1/setup");

  await page.goto("/");
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Finish setting up Focus Timer.")).toBeHidden();
  await page.reload();
  await expect(page.getByText("Finish setting up Focus Timer.")).toBeHidden();
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

test("blocked onboarding storage does not turn import success into failure", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, stale }) => {
      localStorage.setItem(key, stale);
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new Error("blocked");
        setItem.call(this, name, value);
      };
    },
    {
      key: ONBOARDING_STORAGE_KEY,
      stale: JSON.stringify(NOT_STARTED_ONBOARDING),
    },
  );
  await page.goto("/");

  await page.getByRole("button", { name: "Import app" }).click();
  await page
    .getByLabel("Store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(page.getByText(`Imported ${IMPORTED_APP.name}`)).toBeVisible();
  await expect(page).toHaveURL("/apps/app-new/setup");
  await expect(
    page.getByRole("heading", { name: "Set up Imported App" }),
  ).toBeVisible();
  await expect(page.getByText("Could not reach the api")).toHaveCount(0);
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
      .getByLabel("Position 3, strong"),
  ).toHaveAttribute("data-grade", "strong");
  await expect(
    page
      .getByRole("link", { name: /pomodoro/ })
      .getByLabel("Position 12, weak"),
  ).toHaveAttribute("data-grade", "weak");

  await expect(page.getByText("Metadata coverage")).toBeVisible();
  await expect(page.getByText("productivity app")).toBeVisible();

  const refreshDate = utcDateFormatter.format(
    new Date(APP_1_SUMMARY.lastRefreshAt ?? ""),
  );
  await expect(page.getByText("Last refresh")).toBeVisible();
  await expect(page.getByText(refreshDate, { exact: true })).toBeVisible();
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

  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});
