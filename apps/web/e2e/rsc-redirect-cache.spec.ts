import { SESSION_COOKIE } from "@asobeast/shared";
import { expect, test } from "@playwright/test";

test("a redirected rsc request says it varies on the rsc request headers", async ({
  request,
}) => {
  const response = await request.get("/login", {
    headers: { rsc: "1" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("_rsc");
  expect(response.headers().vary).toContain("rsc");
});

test("Back after signing out leaves the sign in address without the rsc key", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: SESSION_COOKIE, value: "e2e", domain: "localhost", path: "/" },
  ]);
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Settings" })
    .click();
  await expect(page).toHaveURL("/settings");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await page.goBack();

  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page).toHaveURL("/login");
});
