import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { seedCookies } from "./routes.mts";
import { VIEWERS, seedViewer } from "./viewer.mts";

const ADMIN_TABS = ["Overview", "Capacity", "Workspaces", "Users", "Apps"];

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
    await expect(
      demand.getByRole("meter", {
        name: "Instance daily request utilization",
      }),
    ).toHaveAttribute("aria-valuetext", "4%");
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

  test("names the top consumers and links to their apps", async ({ page }) => {
    await page.goto("/admin/capacity");

    const consumers = page
      .getByRole("region", { name: "Top consumers" })
      .getByRole("listitem");
    await expect(consumers).toHaveCount(3);
    await expect(consumers.nth(0)).toContainText("Ana Apps");
    await expect(consumers.nth(1)).toContainText("Default");
    await expect(consumers.nth(2)).toContainText("ws_unnamed");
    await expect(
      consumers.nth(0).getByRole("link", { name: "Ana Apps" }),
    ).toHaveAttribute("href", "/admin/apps?workspace=ws_ana");
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

test.describe("workspaces in the admin area", () => {
  test("lists every workspace with its state", async ({ page, context }) => {
    await seedCookies(context, { e2e_billing: "1" });
    await page.goto("/admin/workspaces");

    const table = page.getByRole("table", {
      name: "Workspaces on this instance",
    });
    await expect(table.getByRole("row")).toHaveCount(4);
    const lapsed = table.getByRole("row").filter({ hasText: "Lapsed Studio" });
    await expect(lapsed).toContainText("Suspended");
    await expect(lapsed).toContainText("Sustained rate limit abuse");
    await expect(
      table.getByRole("columnheader", { name: "Plan" }),
    ).toBeVisible();
  });

  test("keeps the search in the address", async ({ page }) => {
    await page.goto("/admin/workspaces");

    await page.getByRole("textbox", { name: "Search workspaces" }).fill("ana");
    await expect(page).toHaveURL(/[?&]q=ana/);
    const table = page.getByRole("table", {
      name: "Workspaces on this instance",
    });
    await expect(table.getByRole("row")).toHaveCount(2);

    await page.reload();
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table).toContainText("Ana Apps");
  });

  test("opens the apps of a workspace", async ({ page }) => {
    await page.goto("/admin/workspaces");

    await page.getByRole("link", { name: "2 apps in Ana Apps" }).click();

    await expect(page).toHaveURL("/admin/apps?workspace=ws_ana");
    await expect(
      page.getByRole("table", { name: "Tracked apps on this instance" }),
    ).toBeVisible();
  });

  test("opens the members of a workspace", async ({ page }) => {
    await page.goto("/admin/workspaces");

    await page.getByRole("link", { name: "2 members in Ana Apps" }).click();

    await expect(page).toHaveURL("/admin/users?workspace=ws_ana");
    await expect(
      page.getByRole("table", { name: "Accounts on this instance" }),
    ).toBeVisible();
  });
});

test.describe("accounts in the admin area", () => {
  test("lists every account newest first", async ({ page }) => {
    await page.goto("/admin/users");

    const rows = page
      .getByRole("table", { name: "Accounts on this instance" })
      .getByRole("row");
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(1)).toContainText("lee@lapsed.example.com");
    await expect(rows.nth(1)).toContainText("Not confirmed");
    await expect(rows.filter({ hasText: "ana@example.com" })).toContainText(
      "Confirmed",
    );
    await expect(rows.filter({ hasText: "owner@example.com" })).toContainText(
      "Operator",
    );
  });

  test("links each account to the apps of its workspace", async ({ page }) => {
    await page.goto("/admin/users");

    const row = page.getByRole("row").filter({ hasText: "ana@example.com" });
    await expect(row.getByRole("link", { name: "Ana Apps" })).toHaveAttribute(
      "href",
      "/admin/apps?workspace=ws_ana",
    );
  });

  test("narrows to one workspace and clears it from a chip", async ({
    page,
  }) => {
    await page.goto("/admin/users?workspace=ws_ana");

    const rows = page
      .getByRole("table", { name: "Accounts on this instance" })
      .getByRole("row");
    await expect(rows).toHaveCount(3);

    await page
      .getByRole("button", { name: "Remove Workspace: Ana Apps" })
      .click();

    await expect(page).toHaveURL("/admin/users");
    await expect(rows).toHaveCount(6);
  });

  test("says when the list stops short of every account", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_admin_truncated: "1" });
    await page.goto("/admin/users");

    await expect(
      page.getByText("Showing the newest 5 of 1,204 accounts."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open a workspace" }),
    ).toHaveAttribute("href", "/admin/workspaces");
  });

  test("ignores a workspace filter the api would refuse", async ({ page }) => {
    for (const workspace of ["", "w".repeat(65)]) {
      await page.goto(`/admin/users?workspace=${workspace}`);

      await expect(
        page
          .getByRole("table", { name: "Accounts on this instance" })
          .getByRole("row"),
      ).toHaveCount(6);
      await expect(
        page.getByRole("list", { name: "Active filters" }),
      ).toHaveCount(0);
    }
  });

  test("shows the plan of each account when billing is on", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_billing: "1" });
    await page.goto("/admin/users");

    await expect(
      page.getByRole("columnheader", { name: "Plan" }),
    ).toBeVisible();
  });

  test("drops the plan column on a self hosted instance", async ({ page }) => {
    for (const [path, name] of [
      ["/admin/users", "Accounts on this instance"],
      ["/admin/workspaces", "Workspaces on this instance"],
    ]) {
      await page.goto(path);
      const table = page.getByRole("table", { name });
      await expect(table.getByRole("row").nth(1)).toBeVisible();
      await expect(
        table.getByRole("columnheader", { name: "Plan" }),
      ).toHaveCount(0);
    }
  });
});

test.describe("tracked apps in the admin area", () => {
  const appsTable = (page: Page) =>
    page.getByRole("table", { name: "Tracked apps on this instance" });

  test("lists every tracked app with its workspace", async ({ page }) => {
    await page.goto("/admin/apps");

    const table = appsTable(page);
    await expect(table.getByRole("row")).toHaveCount(5);
    for (const header of [
      "App",
      "Store",
      "Home market",
      "Workspace",
      "Competitors",
      "Keyword markets",
      "Added",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: header }),
      ).toBeVisible();
    }
    await expect(table).toContainText("Untitled app");
    await expect(table).toContainText("com.ana.habits");
  });

  test("filters by store from a facet kept in the address", async ({
    page,
  }) => {
    await page.goto("/admin/apps");

    await page.getByRole("button", { name: "Filter by store" }).click();
    await page.getByRole("option", { name: /Google Play/ }).click();
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/[?&]store=GOOGLE_PLAY/);
    await expect(appsTable(page).getByRole("row")).toHaveCount(3);

    await page
      .getByRole("button", { name: "Remove Store: Google Play" })
      .click();
    await expect(appsTable(page).getByRole("row")).toHaveCount(5);
  });

  test("narrows to one workspace through the api", async ({ page }) => {
    await page.goto("/admin/apps?workspace=ws_ana");

    await expect(appsTable(page).getByRole("row")).toHaveCount(3);
    await expect(appsTable(page)).not.toContainText("Focus Timer");

    await page
      .getByRole("button", { name: "Remove Workspace: Ana Apps" })
      .click();

    await expect(page).toHaveURL("/admin/apps");
    await expect(appsTable(page).getByRole("row")).toHaveCount(5);
  });

  test("links the workspace to its accounts and never the app itself", async ({
    page,
  }) => {
    await page.goto("/admin/apps");

    const row = appsTable(page)
      .getByRole("row")
      .filter({ hasText: "Ana Habits" });
    await expect(row.getByRole("link", { name: "Ana Apps" })).toHaveAttribute(
      "href",
      "/admin/users?workspace=ws_ana",
    );
    await expect(row.getByRole("link", { name: "Ana Habits" })).toHaveCount(0);
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

    for (const path of [
      "/admin",
      "/admin/capacity",
      "/admin/workspaces",
      "/admin/users",
      "/admin/apps",
    ]) {
      test(`shows the not found page at ${path}`, async ({ page }) => {
        const requested = adminRequests(page);

        await page.goto(path);

        await expect(
          page.getByRole("heading", { level: 1, name: "Page not found" }),
        ).toBeVisible();
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
