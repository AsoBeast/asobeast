import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import {
  ONBOARDING_STORAGE_KEY,
  parseOnboardingState,
} from "../src/lib/onboarding";

const storedStatus = async (page: Page): Promise<string> => {
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    ONBOARDING_STORAGE_KEY,
  );
  return parseOnboardingState(stored).status;
};

const startSetup = async (page: Page, id: string): Promise<void> => {
  await page.goto(`/apps/${id}/setup`);
  await page.getByRole("button", { name: "Start this setup" }).click();
};

test("unknown and unavailable apps render route boundaries", async ({
  page,
}) => {
  await page.goto("/apps/deleted-app/setup");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

  await page.goto("/apps/err-app/setup");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
});

test("a direct visit never enrols without an explicit start", async ({
  page,
}) => {
  await page.goto("/apps/app-1/setup");

  await expect(
    page.getByText("Start setup for this app", { exact: true }),
  ).toBeVisible();
  expect(await storedStatus(page)).toBe("not_started");

  await page.goto("/");
  await expect(page.getByText("Finish setting up")).toBeHidden();

  await startSetup(page, "app-1");
  expect(await storedStatus(page)).toBe("in_progress");
});

test("direct setup is resumable and completes after live checks", async ({
  page,
}) => {
  await startSetup(page, "app-1");

  await expect(
    page.getByRole("heading", { name: "Set up Focus Timer" }),
  ).toBeVisible();
  for (const title of [
    "Choose markets",
    "Add competitors",
    "Confirm keywords",
    "Daily request budget",
    "Configure alerts",
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("United States (US)")).toBeVisible();
  await expect(page.getByText("1 competitor configured")).toBeVisible();
  await expect(page.getByText("4 active")).toBeVisible();

  await page.getByLabel("Add a country code").fill("PL");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Poland (PL)")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review PL keywords" }),
  ).toHaveAttribute("href", "/apps/app-1/keywords?country=pl");
  await expect(page.getByText("0 active")).toBeVisible();

  await page.getByLabel("I reviewed the keywords for these markets").click();
  await page.getByLabel("I reviewed daily request capacity").click();
  const complete = page.getByRole("button", { name: "Complete setup" });
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.getByText("Setup complete", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Setup complete", { exact: true })).toBeVisible();
  expect(await storedStatus(page)).toBe("completed");
});

test("a failed live count blocks completion until a retry succeeds", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-fail-competitors",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await startSetup(page, "app-1");

  await expect(
    page.getByText("Competitor count is temporarily unavailable."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText("Some live counts could not be loaded."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete setup" }),
  ).toBeDisabled();

  await page.context().clearCookies({ name: "e2e-fail-competitors" });
  await page.getByRole("button", { name: "Retry" }).click();

  await expect(page.getByText("1 competitor configured")).toBeVisible();
  await expect(
    page.getByText("Some live counts could not be loaded."),
  ).toBeHidden();
});

test("setup links reach the existing workspaces and anchored settings", async ({
  page,
}) => {
  await startSetup(page, "app-1");

  await page.getByRole("link", { name: "Open capacity settings" }).click();
  await expect(page).toHaveURL("/settings#daily-capacity");
  await expect(
    page.getByText("Daily request budget", { exact: true }),
  ).toBeVisible();

  await page.goBack();
  await page.getByRole("link", { name: "Configure webhooks" }).click();
  await expect(page).toHaveURL("/settings#webhooks");
  await expect(page.getByText("Webhooks", { exact: true })).toBeVisible();

  await page.goBack();
  await page.getByRole("link", { name: "Configure email alerts" }).click();
  await expect(page).toHaveURL("/settings#email-alerts");
  await expect(
    page.locator("#email-alerts").getByText("Email", { exact: true }),
  ).toBeVisible();
});

test("optional alerts can be skipped to complete setup", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "e2e-empty-alerts",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await startSetup(page, "app-2");

  await page.getByLabel("No competitors yet").click();
  await page.getByLabel("I reviewed the keywords for these markets").click();
  await page.getByLabel("I reviewed daily request capacity").click();
  await page.getByLabel("Skip alerts for now").click();
  await page.getByRole("button", { name: "Complete setup" }).click();

  await expect(page.getByText("Setup complete", { exact: true })).toBeVisible();
});

test("corrupt state resets and setup can be dismissed on a narrow dark layout", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, "{broken");
    }
    localStorage.setItem("theme", "dark");
  }, ONBOARDING_STORAGE_KEY);
  await page.setViewportSize({ width: 390, height: 844 });
  await startSetup(page, "app-2");

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByText("United States (US)")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss setup" }).click();
  await expect(
    page.getByText("Setup dismissed", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Setup dismissed", { exact: true }),
  ).toBeVisible();
});
