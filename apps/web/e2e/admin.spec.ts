import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { seedCookies } from "./routes.mts";
import { VIEWERS, seedViewer } from "./viewer.mts";

const ADMIN_TABS = ["Overview", "Capacity"];

const tile = (page: Page, label: string) =>
  page.locator('[data-slot="stat-tile"]').filter({ hasText: label });

const adminRequests = (page: Page): string[] => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend/admin/")) seen.push(request.url());
  });
  return seen;
};

test.describe("the admin area for the platform operator", () => {
  test("opens from the sidebar on an overview of the instance", async ({
    page,
  }) => {
    await page.goto("/");

    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Admin", exact: true })
      .click();

    await expect(page).toHaveURL("/admin");
    await expect(
      page.getByRole("heading", { level: 1, name: "Admin" }),
    ).toBeVisible();
    await expect(tile(page, "Workspaces")).toContainText("3");
    await expect(tile(page, "Users")).toContainText("5");
    await expect(tile(page, "Tracked apps")).toContainText("4");
    await expect(tile(page, "Keyword markets")).toContainText("1,234");
    await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();
  });

  test("moves between tabs that are real links", async ({ page }) => {
    await page.goto("/admin");

    const nav = page.getByRole("navigation", { name: "Admin" });
    for (const tab of ADMIN_TABS) {
      await expect(nav.getByRole("link", { name: tab })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: "Admin", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("keeps the tab row from scrolling vertically", async ({ page }) => {
    await page.goto("/admin");

    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav).toBeVisible();
    expect(
      await nav.evaluate(
        (element) => element.scrollHeight - element.clientHeight,
      ),
    ).toBe(0);
  });

  test("is offered by the command palette", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open command palette" }).click();
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await page.keyboard.type("admin");
    await palette.getByRole("option", { name: "Admin" }).click();

    await expect(page).toHaveURL("/admin");
  });

  test("is listed in the account menu beside the external tools", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Account menu" }).click();
    const menu = page.getByRole("menu");

    await expect(
      menu.getByRole("menuitem", { name: "Admin area" }),
    ).toHaveAttribute("href", "/admin");
    await expect(
      menu.getByRole("menuitem", { name: "Admin area" }),
    ).not.toHaveAttribute("target");
    await expect(
      menu.getByRole("menuitem", { name: "Queue dashboard" }),
    ).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "API docs" }),
    ).toBeVisible();
  });

  test("hides plans on a self hosted instance and still charts sign ups", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_admin_self_hosted: "1" });
    await page.goto("/admin");

    await expect(tile(page, "Workspaces")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plans" })).toHaveCount(0);
    await expect(
      page.getByRole("region", {
        name: "Accounts and workspaces created per day",
      }),
    ).toBeVisible();
  });
});

test.describe("instance capacity in the admin area", () => {
  test("weighs instance demand against capacity", async ({ page }) => {
    await page.goto("/admin/capacity");

    const demand = page.getByRole("region", { name: "Instance demand" });
    await expect(demand).toContainText("1,520 of 36,000 requests/day");
    await expect(demand).toContainText("4%");
    await expect(demand).toContainText("Healthy");
    await expect(
      demand.getByRole("meter", {
        name: "Instance daily request utilization",
      }),
    ).toHaveAttribute("aria-valuenow", "4");
  });

  test("meters each store on its own", async ({ page }) => {
    await page.goto("/admin/capacity");

    await expect(
      page.getByRole("meter", { name: "App Store daily request utilization" }),
    ).toHaveAttribute("aria-valuenow", "5");
    await expect(
      page.getByRole("meter", {
        name: "Google Play daily request utilization",
      }),
    ).toHaveAttribute("aria-valuenow", "3");
  });

  test("names the top consumers, falling back to the id", async ({ page }) => {
    await page.goto("/admin/capacity");

    const consumers = page
      .getByRole("region", { name: "Top consumers" })
      .getByRole("listitem");
    await expect(consumers).toHaveCount(3);
    await expect(consumers.nth(0)).toContainText("Ana Apps");
    await expect(consumers.nth(1)).toContainText("Default");
    await expect(consumers.nth(2)).toContainText("ws_unnamed");
  });

  test("shows the proxy pool only when one is configured", async ({
    page,
    context,
  }) => {
    await page.goto("/admin/capacity");
    await expect(
      page.getByRole("region", { name: "Instance demand" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Proxy pool" })).toHaveCount(
      0,
    );

    await seedCookies(context, { e2e_proxy_pool: "1" });
    await page.reload();

    const pool = page.getByRole("region", { name: "Proxy pool" });
    await expect(pool).toContainText("webshare");
    await expect(pool).toContainText("12 endpoints");
    await expect(pool).toContainText("Few healthy endpoints remain");
    await expect(
      pool.getByRole("link", { name: "Raw pool health" }),
    ).toHaveAttribute("href", "/api/backend/admin/proxy-pool");
  });
});

for (const viewer of VIEWERS) {
  test.describe(`the admin area for a ${viewer}`, () => {
    test.beforeEach(async ({ context }) => {
      await seedViewer(context, viewer);
    });

    test("is offered nowhere", async ({ page }) => {
      await page.goto("/");
      await expect(
        page.getByRole("navigation", { name: "Main" }).getByRole("link", {
          name: "Dashboard",
        }),
      ).toBeVisible();

      await expect(
        page
          .getByRole("navigation", { name: "Main" })
          .getByRole("link", { name: "Admin", exact: true }),
      ).toHaveCount(0);

      await page.getByRole("button", { name: "Open command palette" }).click();
      const palette = page.getByRole("dialog", { name: "Command palette" });
      await expect(
        palette.getByRole("option", { name: "Settings" }),
      ).toBeVisible();
      await expect(palette.getByRole("option", { name: "Admin" })).toHaveCount(
        0,
      );
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Account menu" }).click();
      const menu = page.getByRole("menu");
      await expect(
        menu.getByRole("menuitem", { name: "Sign out" }),
      ).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: /Admin/ })).toHaveCount(
        0,
      );
    });

    for (const path of ["/admin", "/admin/capacity"]) {
      test(`shows the not found page at ${path}`, async ({ page }) => {
        const requested = adminRequests(page);

        await page.goto(path);

        await expect(page.getByText("Page not found")).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Main" }),
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { level: 1, name: "Admin" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("navigation", { name: "breadcrumb" }),
        ).not.toContainText("Admin");
        expect(requested).toEqual([]);
      });
    }
  });
}

test.describe("the admin area when signed out", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("sends the browser to sign in and back", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL("/login?next=%2Fadmin");
  });

  test("leaves the queue dashboard to answer for itself", async ({
    request,
  }) => {
    const response = await request.get("/admin/queues", { maxRedirects: 0 });

    expect(response.status()).not.toBe(307);
    expect(response.headers().location ?? "").not.toContain("/login");
  });
});
