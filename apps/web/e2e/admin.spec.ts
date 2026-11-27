import type { Locator, Page } from "@playwright/test";
import { renderedRgb, renderedTokenRgb } from "./colour.mts";
import { METRICS_SCRAPE, OPERATOR_TOKEN } from "./fixtures.mts";
import { expect, test } from "./session.mts";
import { seedCookies } from "./routes.mts";
import { VIEWERS, seedViewer } from "./viewer.mts";

const ADMIN_TABS = [
  "Overview",
  "Conversion",
  "Capacity",
  "Workspaces",
  "Users",
  "Apps",
];

const tile = (scope: Locator, label: string) =>
  scope
    .locator('[data-slot="stat-tile"]')
    .filter({ has: scope.page().getByText(label, { exact: true }) });

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
    await expect(
      page.getByText(/^8 workspaces · 2 on trial · 2 paying · read /),
    ).toBeVisible();
    const strip = page.getByRole("group", { name: "The instance at a glance" });
    await expect(tile(strip, "Paying")).toContainText("2");
    await expect(tile(strip, "Paying")).toContainText(
      "1 canceling at period end",
    );
    await expect(tile(strip, "On trial")).toContainText(
      "1 trial ends within 3 days",
    );
    await expect(tile(strip, "Trial to paid")).toContainText("36%");
    await expect(tile(strip, "Trial to paid")).toContainText("+14 pts");
    await expect(tile(strip, "Trial to paid")).toContainText(
      "4 of 11 trials ended in 30 days",
    );
    await expect(tile(strip, "Sign ups")).toContainText("11");
    for (const heading of [
      "Funnel",
      "Needs a look",
      "Workspaces by stage",
      "Paying by plan and interval",
      "Instance",
      "Left in the last 30 days",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    await expect(
      page
        .getByRole("list", { name: "Instance totals" })
        .getByRole("listitem")
        .filter({ hasText: "Keyword markets" }),
    ).toContainText("1,234");
  });

  test("the stages panel counts a card trial as a trial", async ({ page }) => {
    await page.goto("/admin");

    const stages = page.getByRole("list", { name: "Workspaces by stage" });
    await expect(
      stages.getByRole("link", { name: "On trial, 2" }),
    ).toHaveAttribute("href", "/admin/workspaces?stage=trialing");
    await expect(stages.getByRole("link", { name: "Paying, 2" })).toBeVisible();
    await expect(stages).not.toContainText("Indie");
  });

  test("counts paying workspaces by plan and interval", async ({ page }) => {
    await page.goto("/admin");

    const paying = page.getByRole("list", {
      name: "Paying by plan and interval",
    });
    await expect(paying.getByRole("listitem")).toHaveText([
      /^Indie · monthly\s*1$/,
      /^Indie · yearly\s*0$/,
      /^Ultimate · monthly\s*0$/,
      /^Ultimate · yearly\s*1$/,
    ]);
    await expect(paying.getByRole("link")).toHaveCount(0);
  });

  test("says so when no workspace is paying", async ({ page, context }) => {
    await seedCookies(context, { e2e_admin_nobody_paying: "1" });
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { name: "Paying by plan and interval" }),
    ).toBeVisible();
    await expect(
      page.getByText("No workspace is paying right now."),
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Paying by plan and interval" }),
    ).toHaveCount(0);
  });

  test("walks the funnel and switches its window in the address", async ({
    page,
  }) => {
    await page.goto("/admin");

    const funnel = page.getByRole("list", { name: "Sign up to paid" });
    await expect(funnel.getByRole("listitem")).toHaveText([
      /Signed up\s*11/,
      /Confirmed email\s*82%\s*9/,
      /Started a trial\s*78%\s*7/,
      /Imported a first app\s*86%\s*6/,
      /Ranked within a day\s*67%\s*4/,
      /Paid\s*50%\s*2/,
    ]);
    await expect(
      page.getByText(
        "Median 0.5 days to a first app · 1.5 days to a trial · 7 days from trial to paid",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(/^Workspaces erased before .+ are not counted\.$/),
    ).toBeVisible();

    const ninety = page.getByRole("tab", { name: "90d" });
    await ninety.click();

    await expect(page).toHaveURL(/[?&]days=90/);
    await expect(funnel.getByRole("listitem").first()).toContainText("33");
    await expect(
      page.getByRole("heading", { name: "Left in the last 90 days" }),
    ).toBeVisible();
    await expect(ninety).toBeFocused();
    await expect(ninety).toHaveAttribute("aria-selected", "true");
  });

  test("lands each look on the workspaces filtered to it", async ({ page }) => {
    await page.goto("/admin");

    const looks = page.getByRole("list", {
      name: "Workspaces that need a look",
    });
    await expect(looks.getByRole("link")).toHaveText([
      /Trial ends within 3 days\s*1/,
      /Canceling at period end\s*1/,
      /Payment failed\s*1/,
      /Pending deletion\s*1/,
      /Suspended\s*1/,
    ]);

    await looks.getByRole("link", { name: "Pending deletion, 1" }).click();

    await expect(page).toHaveURL("/admin/workspaces?flag=deleting");
    const rows = page
      .getByRole("table", { name: "Workspaces on this instance" })
      .getByRole("row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText("Kestrel Apps");
    await expect(
      page.getByRole("button", { name: "Remove Pending deletion" }),
    ).toBeVisible();
  });

  test("says why workspaces left and opens every departure", async ({
    page,
  }) => {
    await page.goto("/admin");

    const reasons = page.getByRole("list", { name: "Why workspaces left" });
    await expect(reasons.getByRole("listitem")).toHaveText([
      /Too expensive\s*1/,
      /Not using it\s*1/,
      /No answer\s*1/,
    ]);
    await expect(
      page.getByText(
        "By stage when they asked to leave: 1 paying · 2 trial ended.",
      ),
    ).toBeVisible();

    await page.getByRole("link", { name: "See every departure" }).click();

    await expect(page).toHaveURL("/admin/conversion");
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

  test("fades the tab row where tabs are out of view on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin");

    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav).toHaveAttribute("data-edges", "end");

    await nav.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });

    await expect(nav).toHaveAttribute("data-edges", "start");
  });

  test("is offered by the command palette", async ({ page }) => {
    await page.goto("/");

    await page.locator('[data-action="open-command-palette"]').click();
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

  test("leaves billing out on a self hosted instance and still charts sign ups", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_admin_self_hosted: "1" });
    await page.goto("/admin");

    await expect(
      page.getByText(/^8 workspaces · 5 accounts · read /),
    ).toBeVisible();
    const strip = page.getByRole("group", { name: "The instance at a glance" });
    for (const label of ["Workspaces", "Accounts", "Sign ups", "Activation"]) {
      await expect(tile(strip, label)).toBeVisible();
    }
    await expect(tile(strip, "Activation")).toContainText("9 of 12");
    await tile(strip, "Activation")
      .getByRole("button", { name: "What activation means" })
      .click();
    await expect(
      page.getByRole("link", { name: "Read how activation is counted" }),
    ).toHaveAttribute(
      "href",
      "https://docs.asobeast.com/security/admin-surfaces#activation",
    );
    await page.keyboard.press("Escape");
    for (const heading of [
      "Workspaces by stage",
      "Paying by plan and interval",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
    }
    await expect(
      page.getByRole("list", { name: "Sign up to paid" }).getByRole("listitem"),
    ).toHaveCount(4);
    await expect(
      page
        .getByRole("list", { name: "Workspaces that need a look" })
        .getByRole("link"),
    ).toHaveCount(2);
    await expect(
      page.getByRole("region", { name: "Accounts created per day" }),
    ).toBeVisible();
  });
});

test.describe("conversion in the admin area", () => {
  test("follows eight weekly cohorts and lists every departure", async ({
    page,
  }) => {
    await page.goto("/admin/conversion");

    const cohorts = page.getByRole("table", {
      name: "Sign ups by week and how far each week got",
    });
    await expect(cohorts.getByRole("row")).toHaveCount(9);
    for (const header of [
      "Week of",
      "Signed up",
      "Confirmed",
      "Trial",
      "First app",
      "Paid",
      "Still paying",
    ]) {
      await expect(
        cohorts.getByRole("columnheader", { name: header, exact: true }),
      ).toBeVisible();
    }
    const departures = page.getByRole("table", {
      name: "Erased workspaces, newest first",
    });
    await expect(departures.getByRole("row")).toHaveCount(4);
    await expect(departures.getByRole("row").nth(1)).toContainText(
      "Too expensive",
    );
    await expect(departures.getByRole("row").nth(1)).toContainText(
      "Ultimate · paid before",
    );
    await expect(departures).not.toContainText("@");
  });

  test("says so when nobody signed up or left", async ({ page, context }) => {
    await seedCookies(context, { e2e_admin_conversion_empty: "1" });
    await page.goto("/admin/conversion");

    await expect(
      page.getByText("No workspace signed up in the last 8 weeks."),
    ).toBeVisible();
    await expect(
      page.getByText(/^No workspace has been erased since /),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("drops the billing columns on a self hosted instance", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_admin_self_hosted: "1" });
    await page.goto("/admin/conversion");

    const cohorts = page.getByRole("table", {
      name: "Sign ups by week and how far each week got",
    });
    await expect(cohorts.getByRole("row").nth(1)).toBeVisible();
    await expect(cohorts.getByRole("columnheader")).toHaveText([
      "Week of",
      "Signed up",
      "Confirmed",
      "First app",
    ]);
    await expect(
      page
        .getByRole("table", { name: "Erased workspaces, newest first" })
        .getByRole("columnheader", { name: "Stage" }),
    ).toHaveCount(0);
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

    const healthyBar = page
      .getByRole("meter", { name: "App Store daily request utilization" })
      .locator(":scope > div");
    expect(await renderedRgb(healthyBar, "backgroundColor")).toEqual(
      await renderedTokenRgb(page, "--success"),
    );
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
    await expect(pool).toContainText(
      "1 endpoint refused by the proxy provider: the plan or its quota is used up (HTTP 402).",
    );
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
    await expect(table.getByRole("row")).toHaveCount(9);
    await expect(
      table.getByRole("columnheader", { name: "Stage" }),
    ).toBeVisible();
    const row = (name: string) =>
      table.getByRole("row").filter({ hasText: name });
    await expect(row("Lapsed Studio")).toContainText("Suspended");
    await expect(row("Lapsed Studio")).toContainText(
      "Sustained rate limit abuse",
    );
    await expect(row("Northwind Labs")).toContainText("On trial · Indie");
    await expect(row("Northwind Labs")).toContainText(/Trial until /);
    await expect(row("Harbor Apps")).toContainText("Paying · Ultimate");
    await expect(row("Harbor Apps")).toContainText(/Canceling /);
    await expect(row("Fjord Tools")).toContainText("Payment failed");
    await expect(row("Kestrel Apps")).toContainText(/Deletes /);
    await expect(row("Kestrel Apps")).toContainText(
      "Asked by kai@kestrel.example.com",
    );
    await expect(row("Quiet Pixel")).not.toContainText(/canceled/i);
    await expect(
      page.getByText("Each read is written to the support audit trail."),
    ).toBeVisible();
  });

  test("filters by stage and by what needs a look, kept in the address", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_billing: "1" });
    await page.goto("/admin/workspaces");

    await page
      .locator('[data-action="filters"][data-filter-trigger="popover"]')
      .click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    await filters.getByRole("button", { name: "Filter by stage" }).click();
    await page.getByRole("option", { name: /^Paying/ }).click();
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/[?&]stage=paying/);
    const rows = page
      .getByRole("table", { name: "Workspaces on this instance" })
      .getByRole("row");
    await expect(rows).toHaveCount(3);

    await page.goto("/admin/workspaces?stage=paying&flag=canceling");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText("Harbor Apps");

    await page
      .getByRole("button", { name: "Remove Canceling at period end" })
      .click();
    await expect(page).toHaveURL("/admin/workspaces?stage=paying");
    await expect(rows).toHaveCount(3);
  });

  test("closes the Filters dialog with Escape and returns focus to Filters", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_billing: "1" });
    await page.goto("/admin/workspaces");

    const filtersButton = page.locator(
      '[data-action="filters"][data-filter-trigger="popover"]',
    );
    const filters = page.getByRole("dialog", { name: "Filters" });
    await filtersButton.click();
    await expect(filters).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(filters).toBeHidden();
    await expect(filtersButton).toBeFocused();

    await filtersButton.click();
    await filters.getByRole("button", { name: "Filter by stage" }).click();
    await page.getByRole("option", { name: /^Churned/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(
      filters.getByRole("button", { name: /^Filter by stage/ }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(filters).toBeHidden();
    await expect(page).toHaveURL(/[?&]stage=churned/);
    await expect(filtersButton).toBeFocused();
  });

  test("keeps pending deletions and suspensions on a self hosted instance", async ({
    page,
  }) => {
    await page.goto("/admin/workspaces?flag=suspended");

    const rows = page
      .getByRole("table", { name: "Workspaces on this instance" })
      .getByRole("row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText("Suspended");
    await page
      .locator('[data-action="filters"][data-filter-trigger="popover"]')
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Filters" })
        .getByRole("button", { name: "Filter by stage" }),
    ).toHaveCount(0);
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
    await expect(rows).toHaveCount(7);
    await expect(rows.nth(1)).toContainText("nia@northwind.example.com");
    await expect(rows.nth(2)).toContainText("lee@lapsed.example.com");
    await expect(rows.nth(2)).toContainText("Not confirmed");
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
    await expect(rows).toHaveCount(7);
  });

  test("says when the list stops short of every account", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_admin_truncated: "1" });
    await page.goto("/admin/users");

    await expect(
      page.getByText("Showing the newest 6 of 1,204 accounts."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open a workspace" }),
    ).toHaveAttribute("href", "/admin/workspaces");
  });

  test("ignores a workspace filter the api would refuse", async ({ page }) => {
    for (const workspace of ["", "all", "w".repeat(65)]) {
      await page.goto(`/admin/users?workspace=${workspace}`);

      await expect(
        page
          .getByRole("table", { name: "Accounts on this instance" })
          .getByRole("row"),
      ).toHaveCount(7);
      await expect(
        page.getByRole("list", { name: "Active filters" }),
      ).toHaveCount(0);
    }
  });

  test("shows the stage of each account's workspace when billing is on", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_billing: "1" });
    await page.goto("/admin/users");

    await expect(
      page.getByRole("columnheader", { name: "Stage" }),
    ).toBeVisible();
    const nia = page
      .getByRole("row")
      .filter({ hasText: "nia@northwind.example.com" });
    await expect(nia).toContainText("On trial");
    await expect(nia).toContainText("Indie");
  });

  test("drops the stage column of accounts on a self hosted instance", async ({
    page,
  }) => {
    await page.goto("/admin/users");
    const table = page.getByRole("table", {
      name: "Accounts on this instance",
    });
    await expect(table.getByRole("row").nth(1)).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Stage" }),
    ).toHaveCount(0);
  });

  test("keeps an account's confirmation named when a phone shows only its mark", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/admin/users");

    const lee = page
      .getByRole("row")
      .filter({ hasText: "lee@lapsed.example.com" });
    const word = await lee.getByText("Not confirmed").boundingBox();
    expect(word?.width).toBeLessThanOrEqual(1);
    await expect(lee.getByRole("cell", { name: /Not confirmed/ })).toHaveCount(
      1,
    );
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

      await page.locator('[data-action="open-command-palette"]').click();
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

        await expect(page.locator('[data-slot="not-found"]')).toBeVisible();
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

  test("serves the metrics scrape to an operator token without a sign in", async ({
    request,
  }) => {
    const response = await request.get("/metrics", {
      maxRedirects: 0,
      headers: { authorization: `Bearer ${OPERATOR_TOKEN}` },
    });

    expect(response.status()).toBe(200);
    expect(await response.text()).toBe(METRICS_SCRAPE);
  });

  test("answers a metrics scrape without a token as not found", async ({
    request,
  }) => {
    const response = await request.get("/metrics", { maxRedirects: 0 });

    expect(response.status()).toBe(404);
    expect(response.headers().location).toBeUndefined();
  });
});
