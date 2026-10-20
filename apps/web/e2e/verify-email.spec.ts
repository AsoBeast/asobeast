import type { Page } from "@playwright/test";
import type { AuthUser } from "@asobeast/shared";
import { activateTwiceInOneTask, hydrated } from "./hydrated.mts";
import { fulfillJson } from "./plan-helpers.mts";
import { expect, test } from "./session.mts";

const CONFIRM = "Confirm my email";
const RESEND = "Send me a new link";
const SPENT = "That verification link is no longer valid";

const CONFIRMED_USER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  emailVerified: true,
  name: "Owner",
  role: "owner",
  plan: "free",
  trialEndsAt: null,
  planExpiresAt: null,
  entitled: true,
  platformOperator: false,
};

const spentLink = () =>
  fulfillJson(404, {
    statusCode: 404,
    error: "Not Found",
    message: SPENT,
    path: "/auth/verify",
    timestamp: new Date().toISOString(),
  });

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function routeVerify(
  page: Page,
  answers: ReadonlyArray<200 | 404>,
  delayMs = 0,
) {
  const posts: string[] = [];
  await page.route("**/api/backend/auth/verify", async (route) => {
    const answer = answers[Math.min(posts.length, answers.length - 1)];
    posts.push(route.request().url());
    await pause(delayMs);
    await route.fulfill(
      answer === 200 ? fulfillJson(200, CONFIRMED_USER) : spentLink(),
    );
  });
  return posts;
}

async function routeResend(page: Page) {
  const posts: string[] = [];
  await page.route("**/api/backend/auth/verify/resend", async (route) => {
    posts.push(route.request().url());
    await route.fulfill({ status: 204, body: "" });
  });
  return posts;
}

const confirmButton = (page: Page) =>
  page.getByRole("button", { name: CONFIRM });

test.describe("the confirmation page sends one request per press", () => {
  test("a double click on Confirm my email sends one request and shows no refusal", async ({
    page,
  }) => {
    const posts = await routeVerify(page, [200, 404], 300);
    await page.goto("/verify?token=link");

    await (await hydrated(confirmButton(page))).dblclick();

    await expect(page.getByText(SPENT)).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/verify/);
    expect(posts).toHaveLength(1);
  });

  test("two activations of Confirm my email in one task send one request", async ({
    page,
  }) => {
    const posts = await routeVerify(page, [200, 404], 300);
    await page.goto("/verify?token=link");

    await activateTwiceInOneTask(confirmButton(page));

    await expect(page).not.toHaveURL(/\/verify/);
    expect(posts).toHaveLength(1);
    await expect(page.getByText(SPENT)).toHaveCount(0);
  });

  test("Confirm my email keeps focus and says it is busy while the request runs", async ({
    page,
  }) => {
    await routeVerify(page, [200], 1500);
    await page.goto("/verify?token=link");
    const button = await hydrated(confirmButton(page));

    await button.focus();
    await button.press("Enter");

    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).toBeFocused();
    await expect(page).not.toHaveURL(/\/verify/);
  });

  test("a refused link can be pressed again and sends a new request", async ({
    page,
  }) => {
    const posts = await routeVerify(page, [404, 200]);
    await page.goto("/verify?token=link");
    const button = await hydrated(confirmButton(page));

    await button.click();
    await expect(page.getByText(SPENT)).toBeVisible();
    await expect(button).not.toHaveAttribute("aria-disabled", "true");
    await button.click();

    await expect(page).not.toHaveURL(/\/verify/);
    expect(posts).toHaveLength(2);
  });

  test("two activations of Send me a new link in one task send one request", async ({
    page,
  }) => {
    await routeVerify(page, [404]);
    const resends = await routeResend(page);
    await page.goto("/verify?token=spent");
    await (await hydrated(confirmButton(page))).click();
    await expect(page.getByText(SPENT)).toBeVisible();

    await activateTwiceInOneTask(page.getByRole("button", { name: RESEND }));

    await expect(
      page.getByRole("button", { name: "New link sent" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(resends).toHaveLength(1);
  });
});
