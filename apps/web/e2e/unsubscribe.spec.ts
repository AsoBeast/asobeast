import type { APIRequestContext, Page } from "@playwright/test";
import { VALID_UNSUBSCRIBE_TOKEN } from "./fixtures.mts";
import { expect, test } from "./reporting.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

async function callsFor(
  request: APIRequestContext,
  alert: string,
): Promise<number> {
  const response = await request.get(`${MOCK_API_URL}/__unsubscribes/${alert}`);
  return ((await response.json()) as { calls: number }).calls;
}

async function openLink(page: Page, alert: string, token: string) {
  await page.goto(`/unsubscribe?alert=${alert}&token=${token}`);
  await expect(
    page.getByRole("heading", { name: "Stop email alerts?" }),
  ).toBeVisible();
}

test("asks before unsubscribing and never acts on load", async ({
  page,
  request,
}) => {
  await openLink(page, "ea_load", VALID_UNSUBSCRIBE_TOKEN);
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/unsubscribe\?/);
  expect(await callsFor(request, "ea_load")).toBe(0);
});

test("unsubscribes with one request after the button is pressed", async ({
  page,
  request,
}) => {
  await openLink(page, "ea_click", VALID_UNSUBSCRIBE_TOKEN);

  await page.getByRole("button", { name: "Unsubscribe" }).click();

  await expect(
    page.getByRole("heading", { name: "You are unsubscribed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open settings" }),
  ).toHaveAttribute("href", "/settings#email-alerts");
  expect(await callsFor(request, "ea_click")).toBe(1);
});

test("explains a link that is no longer valid", async ({ page }) => {
  await openLink(page, "ea_invalid", "stale-token".padEnd(43, "y"));

  await page.getByRole("button", { name: "Unsubscribe" }).click();

  await expect(
    page.getByRole("heading", { name: "This unsubscribe link is not valid" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage alerts in Settings" }),
  ).toHaveAttribute("href", "/settings#email-alerts");
});

test("asks for the link from the email when it is incomplete", async ({
  page,
}) => {
  await page.goto("/unsubscribe");

  await expect(
    page.getByRole("heading", { name: "Unsubscribe link incomplete" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Unsubscribe" })).toHaveCount(
    0,
  );
});

test("unsubscribes with the keyboard alone", async ({ page, request }) => {
  await openLink(page, "ea_keyboard", VALID_UNSUBSCRIBE_TOKEN);
  const button = page.getByRole("button", { name: "Unsubscribe" });

  for (let press = 0; press < 10; press += 1) {
    if (await button.evaluate((node) => node === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(
    page.getByRole("heading", { name: "You are unsubscribed" }),
  ).toBeVisible();
  expect(await callsFor(request, "ea_keyboard")).toBe(1);
});
