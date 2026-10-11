import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import {
  EXPIRED_CONFIRM_TOKEN,
  TRUSTED_RECIPIENT,
  VALID_CONFIRM_TOKEN,
} from "./fixtures.mts";
import { openSettledDialog } from "./dialog.mts";
import { expect, test } from "./session.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const AWAITING = "Awaiting confirmation.";

async function callsFor(
  request: APIRequestContext,
  alert: string,
): Promise<{ confirms: number; resends: number }> {
  const response = await request.get(
    `${MOCK_API_URL}/__confirmations/${alert}`,
  );
  return (await response.json()) as { confirms: number; resends: number };
}

async function openLink(page: Page, alert: string, token: string) {
  await page.goto(`/confirm-alert?alert=${alert}&token=${token}`);
  await expect(
    page.getByRole("heading", { name: "Confirm alert emails?" }),
  ).toBeVisible();
}

async function addRecipient(page: Page, address: string) {
  await page.goto("/settings");
  const dialog = await openSettledDialog(page, "Add email alert");
  await page.getByLabel("Recipient email").fill(address);
  await dialog
    .getByRole("button", { name: "Add email alert", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  return page.getByRole("listitem").filter({ hasText: address });
}

test("asks before confirming and never acts on load", async ({
  page,
  request,
}) => {
  await openLink(page, "ea_load", VALID_CONFIRM_TOKEN);
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/confirm-alert\?/);
  expect((await callsFor(request, "ea_load")).confirms).toBe(0);
});

test("confirms with one request after the button is pressed", async ({
  page,
  request,
}) => {
  await openLink(page, "ea_click", VALID_CONFIRM_TOKEN);

  await page.getByRole("button", { name: "Confirm email address" }).click();

  await expect(
    page.getByRole("heading", { name: "Alert emails confirmed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open settings" }),
  ).toHaveAttribute("href", "/settings#email-alerts");
  expect((await callsFor(request, "ea_click")).confirms).toBe(1);
});

test("explains a link that is no longer valid", async ({ page }) => {
  await openLink(page, "ea_invalid", "stale-token".padEnd(43, "y"));

  await page.getByRole("button", { name: "Confirm email address" }).click();

  await expect(
    page.getByRole("heading", { name: "This confirmation link is not valid" }),
  ).toBeVisible();
});

test("explains a link that has expired", async ({ page }) => {
  await openLink(page, "ea_expired", EXPIRED_CONFIRM_TOKEN);

  await page.getByRole("button", { name: "Confirm email address" }).click();

  await expect(
    page.getByRole("heading", {
      name: "This confirmation link has expired",
    }),
  ).toBeVisible();
});

test("asks for the link from the email when it is incomplete", async ({
  page,
}) => {
  await page.goto("/confirm-alert");

  await expect(
    page.getByRole("heading", { name: "Confirmation link incomplete" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm email address" }),
  ).toHaveCount(0);
});

test("a new recipient waits for confirmation and can be asked again", async ({
  page,
}) => {
  const address = `stranger-${randomUUID()}@example.net`;

  const row = await addRecipient(page, address);

  await expect(row.getByText(AWAITING)).toBeVisible();
  await expect(row.getByRole("button", { name: "Send test" })).toHaveCount(0);
  const resend = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith("/resend-confirmation"),
  );
  await row.getByRole("button", { name: "Resend confirmation" }).click();
  await resend;
  await expect(
    page.getByText(`Confirmation email sent to ${address}`),
  ).toBeVisible();
});

test("a recipient the workspace already trusts can be tested at once", async ({
  page,
}) => {
  const row = await addRecipient(page, TRUSTED_RECIPIENT);

  await expect(row.getByText(AWAITING)).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Send test" })).toBeVisible();
});

test("a confirmed recipient shows no waiting notice", async ({ page }) => {
  await page.goto("/settings");

  const row = page.getByRole("listitem").filter({ hasText: "ops@example.com" });

  await expect(row.getByRole("button", { name: "Send test" })).toBeVisible();
  await expect(row.getByText(AWAITING)).toHaveCount(0);
});
