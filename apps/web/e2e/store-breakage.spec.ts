import { expect, test } from "./session.mts";
import { APP_1_DETAIL } from "./fixtures.mts";

const LAYOUT_ROUTES = [
  ["the dashboard", "/"],
  ["an app overview", `/apps/${APP_1_DETAIL.id}`],
  ["the keywords page", `/apps/${APP_1_DETAIL.id}/keywords`],
] as const;

function cookie(name: string) {
  return { name, value: "1", domain: "localhost", path: "/" };
}

test.describe("with a broken App Store parser", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([cookie("e2e_store_broken")]);
  });

  for (const [where, route] of LAYOUT_ROUTES) {
    test(`the banner is mounted by the layout on ${where}`, async ({
      page,
    }) => {
      await page.goto(route);

      await expect(
        page.getByRole("alert").filter({ hasText: "parsing looks broken" }),
      ).toBeVisible();
    });
  }

  test("it names the store, says data is untouched, and links the runbook", async ({
    page,
  }) => {
    await page.goto("/");

    const banner = page
      .getByRole("alert")
      .filter({ hasText: "parsing looks broken" });
    await expect(banner).toContainText("App Store parsing looks broken");
    await expect(banner).toContainText("This is on us");
    await expect(banner).toContainText("stored data is untouched");
    await expect(
      banner.getByRole("link", { name: "What happens next" }),
    ).toHaveAttribute(
      "href",
      "https://docs.asobeast.com/operations/scraper-breakage",
    );
  });

  test("the delayed run it causes does not stack a second banner", async ({
    page,
    context,
  }) => {
    await context.addCookies([cookie("e2e_run_delayed")]);
    await page.goto("/");

    await expect(
      page.getByRole("alert").filter({ hasText: "parsing looks broken" }),
    ).toBeVisible();
    await expect(page.getByText("are delayed")).toHaveCount(0);
  });
});

test("a delayed run is named for the store that is behind while every store parses", async ({
  page,
  context,
}) => {
  await context.addCookies([cookie("e2e_run_delayed")]);
  await page.goto("/");

  const notice = page.getByRole("status").filter({ hasText: "are delayed" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    "Rankings for your Google Play apps are delayed",
  );
  await expect(notice).toContainText("50 of 100");
});

test("no banner appears while every store parses and the run is on time", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("are delayed")).toHaveCount(0);
  await expect(page.getByText("parsing looks broken")).toHaveCount(0);
});
