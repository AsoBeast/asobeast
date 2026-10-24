import type { Page } from "@playwright/test";
import { SESSION_COOKIE } from "@asobeast/shared";
import { collectPageErrors } from "./page-errors.mts";
import { expect, test } from "./reporting.mts";
import { SIGNED_IN_ROUTES } from "./routes.mts";

const STALE = {
  name: SESSION_COOKIE,
  value: "stale",
  domain: "localhost",
  path: "/",
};
const BROWSER_REFUSAL_LINE = "Failed to load resource";
const DATA_PAGES = [
  "/",
  "/actions",
  "/charts",
  "/settings",
  "/integrations",
  "/apps/app-1",
] as const;

function renderErrors(page: Page): string[] {
  const errors = collectPageErrors(page);
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith(BROWSER_REFUSAL_LINE)
    ) {
      errors.push(message.text());
    }
  });
  return errors;
}

for (const [name, path] of SIGNED_IN_ROUTES) {
  test(`${name} sends a stale session to sign in without a page error`, async ({
    page,
    context,
  }) => {
    await context.addCookies([STALE]);
    const errors = renderErrors(page);

    await page.goto(path);

    await expect(page).toHaveURL(/\/login(\?|$)/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(
      path === "/" ? null : path,
    );
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test(`${name} renders no api error on the server for a stale session`, async ({
    request,
  }) => {
    const response = await request.get(path, {
      headers: { cookie: `${SESSION_COOKIE}=stale` },
    });

    expect(await response.text()).not.toContain("ASOBEAST_API_ERROR");
  });
}

for (const path of DATA_PAGES) {
  test(`${path} redirects inside the render for a stale session`, async ({
    request,
  }) => {
    const response = await request.get(path, {
      headers: { cookie: `${SESSION_COOKIE}=stale` },
    });

    expect(await response.text()).toMatch(/NEXT_REDIRECT;replace;\/login/);
  });
}

test("a stale session keeps the whole requested address, query included", async ({
  page,
  context,
}) => {
  await context.addCookies([STALE]);

  await page.goto("/charts?store=APP_STORE&country=de&genre=6011");

  await expect(page).toHaveURL(
    /\/login\?next=%2Fcharts%3Fstore%3DAPP_STORE%26country%3Dde%26genre%3D6011$/,
  );
});

test("a browser supplied requested path header never steers the redirect", async ({
  request,
}) => {
  const response = await request.get("/charts", {
    headers: {
      cookie: `${SESSION_COOKIE}=stale`,
      "x-asobeast-requested-path": "//evil.example/steal",
    },
  });

  const html = await response.text();
  expect(html).toMatch(/NEXT_REDIRECT;replace;\/login\?next=%2Fcharts/);
  expect(html).not.toContain("evil.example");
});

test("the stale session redirect does not trap the public routes", async ({
  page,
  context,
}) => {
  await context.addCookies([STALE]);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
