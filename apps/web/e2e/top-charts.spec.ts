import { type APIRequestContext, type Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { contrastViolations, THEMES } from "./contrast-check.mts";
import {
  TOP_CHART_APPS,
  TOP_CHART_DATES,
  TOP_GROSSING_CHART_APPS,
  TOP_PAID_CHART_APPS,
  utcDaysAgo,
} from "./fixtures.mts";

const formatDayMonth = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

const formatDay = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

const chartTable = (page: Page) => page.getByRole("table");

const kindRegion = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

const pick = async (page: Page, control: string, option: string) => {
  await page.getByRole("combobox", { name: control }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

test("renders the chart for the default filters", async ({ page }) => {
  await page.goto("/charts?view=table");

  await expect(
    page.getByRole("heading", { level: 1, name: "Top charts" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Store" }).getByRole("tab", {
      name: "App Store",
    }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("combobox", { name: "Country" })).toHaveText(
    "US · United States",
  );
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveText(
    "Overall",
  );
  const rows = chartTable(page).locator("tbody tr");
  await expect(rows).toHaveCount(TOP_CHART_APPS.length);
  const first = rows.first();
  await expect(first.getByRole("cell").first()).toHaveText("1");
  await expect(first).toContainText(TOP_CHART_APPS[0].title);
  await expect(first).toContainText(TOP_CHART_APPS[0].developer ?? "");
});

test("opens on the three charts side by side", async ({ page }) => {
  await page.goto("/charts");

  for (const [name, rows] of [
    ["Free", TOP_CHART_APPS],
    ["Paid", TOP_PAID_CHART_APPS],
    ["Grossing", TOP_GROSSING_CHART_APPS],
  ] as const) {
    const items = kindRegion(page, name).getByRole("listitem");
    await expect(items).toHaveCount(rows.length);
    await expect(items.first()).toContainText(rows[0].title);
    await expect(items.first()).toContainText("1");
  }
  await expect(
    kindRegion(page, "Free").getByText("Puzzle Quest", { exact: true }),
  ).toBeVisible();
  await expect(
    kindRegion(page, "Paid").getByText("Puzzle Quest", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByRole("tablist", { name: "Chart", exact: true }),
  ).toHaveCount(0);
});

test("opens the table of one kind from its column", async ({ page }) => {
  await page.goto("/charts");

  await kindRegion(page, "Paid")
    .getByRole("link", { name: "Open table of Paid" })
    .click();

  await expect(page).toHaveURL(/view=table/);
  await expect(page).toHaveURL(/collection=paid/);
  await expect(page.getByRole("table", { name: /^Top paid/ })).toBeVisible();
});

test("switches the layout", async ({ page }) => {
  await page.goto("/charts");
  const layout = page.getByRole("tablist", { name: "Layout" });

  await layout.getByRole("tab", { name: "Table" }).click();

  await expect(page).toHaveURL(/view=table/);
  await expect(chartTable(page)).toBeVisible();

  await layout.getByRole("tab", { name: "Side by side" }).click();

  await expect(page).not.toHaveURL(/view=/);
  await expect(kindRegion(page, "Grossing")).toBeVisible();
});

test("captures today from a column", async ({ page, request }) => {
  await request.get(`${MOCK_API}/__forget-chart-captures/6005`);
  await page.goto("/charts?genre=6005");
  await expect(page.getByRole("button", { name: "Capture today" })).toHaveCount(
    3,
  );

  await kindRegion(page, "Paid")
    .getByRole("button", { name: "Capture today" })
    .click();

  await expect(page.getByText("Captured today's chart")).toBeVisible();
  await expect(kindRegion(page, "Paid")).toContainText(
    formatDayMonth(utcDaysAgo(0)),
  );
  await expect(
    kindRegion(page, "Paid").getByRole("button", { name: "Capture today" }),
  ).toHaveCount(0);
  await expect(
    kindRegion(page, "Free").getByRole("button", { name: "Capture today" }),
  ).toBeVisible();
  const captures = (await (
    await request.get(`${MOCK_API}/__chart-captures`)
  ).json()) as Array<Record<string, string>>;
  expect(captures.filter((capture) => capture.genre === "6005")).toEqual([
    {
      store: "APP_STORE",
      country: "us",
      collection: "paid",
      genre: "6005",
      device: "iphone",
    },
  ]);
});

test("shows movement for each kind in the trending panel", async ({ page }) => {
  await page.goto("/charts");
  const trending = page.getByRole("complementary", { name: "Trending" });

  await expect(trending.getByText(TOP_CHART_APPS[7].title)).toBeVisible();

  await trending
    .getByRole("tablist", { name: "Chart kind" })
    .getByRole("tab", { name: "Paid" })
    .click();

  await expect(trending.getByText(TOP_PAID_CHART_APPS[7].title)).toBeVisible();
  await expect(trending.getByText(TOP_CHART_APPS[7].title)).toHaveCount(0);
});

for (const theme of THEMES) {
  test(`the table view has no contrast violation in the ${theme} theme`, async ({
    page,
  }) => {
    expect(await contrastViolations(page, theme, "/charts?view=table")).toEqual(
      [],
    );
  });
}

test("keeps every filter in the url", async ({ page }) => {
  await page.goto("/charts?view=table");

  await page
    .getByRole("tablist", { name: "Store" })
    .getByRole("tab", { name: "Google Play" })
    .click();
  await pick(page, "Country", "DE · Germany");
  await pick(page, "Category", "Puzzle");
  await page
    .getByRole("tablist", { name: "Chart" })
    .getByRole("tab", { name: "Grossing" })
    .click();

  await expect(page).toHaveURL(/store=GOOGLE_PLAY/);
  await expect(page).toHaveURL(/country=de/);
  await expect(page).toHaveURL(/genre=GAME_PUZZLE/);
  await expect(page).toHaveURL(/collection=grossing/);

  await page
    .getByRole("tablist", { name: "Store" })
    .getByRole("tab", { name: "App Store" })
    .click();

  await expect(page).not.toHaveURL(/genre=/);
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveText(
    "Overall",
  );
});

test("shows a device control only for a store with more than one device", async ({
  page,
}) => {
  await page.goto("/charts?view=table");
  await expect(page.getByRole("combobox", { name: "Category" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /device/i })).toHaveCount(0);

  await page.goto("/charts?view=table&store=GOOGLE_PLAY");
  await expect(page.getByRole("combobox", { name: "Category" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /device/i })).toHaveCount(0);
});

test("keeps the filters on one row without captions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/charts");
  const store = await page
    .getByRole("tablist", { name: "Store" })
    .boundingBox();
  const layout = await page
    .getByRole("tablist", { name: "Layout" })
    .boundingBox();

  expect(Math.abs((store?.y ?? 0) - (layout?.y ?? 100))).toBeLessThan(8);
  await expect(page.getByText("Compare", { exact: true })).toHaveCount(0);
});

test("folds the filters into a sheet on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/charts");

  await expect(page.getByRole("tablist", { name: "Store" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Captured day/ }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Country" })).toHaveCount(0);

  await page.getByRole("button", { name: "Filters" }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet.getByRole("combobox", { name: "Country" })).toBeVisible();
  await expect(sheet.getByRole("combobox", { name: /compare/i })).toBeVisible();
  await pick(page, "Category", "Puzzle");

  await expect(page).toHaveURL(/genre=7012/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Filters 1" })).toBeVisible();
});

test("picks a captured day", async ({ page }) => {
  await page.goto("/charts?view=table");
  const oldest = TOP_CHART_DATES.at(-1) ?? "";
  const newest = TOP_CHART_DATES[0];

  await page.getByRole("button", { name: /^Captured day/ }).click();
  await expect(
    page.getByRole("grid").getByRole("button", { name: formatDay(newest) }),
  ).toBeEnabled();
  await expect(
    page
      .getByRole("grid")
      .getByRole("button", { name: formatDay(utcDaysAgo(4)) }),
  ).toBeDisabled();
  if (oldest.slice(0, 7) !== newest.slice(0, 7)) {
    await page.getByRole("button", { name: "Previous month" }).click();
  }
  await page
    .getByRole("grid")
    .getByRole("button", { name: formatDay(oldest) })
    .click();

  await expect(page).toHaveURL(new RegExp(`date=${oldest}`));
  await expect(chartTable(page).locator("caption")).toContainText(
    formatDay(oldest),
  );

  await page.getByRole("button", { name: "Next captured day" }).click();
  await expect(page).toHaveURL(new RegExp(`date=${TOP_CHART_DATES.at(-2)}`));

  await page.goto(`/charts?view=table&date=${newest}`);
  await expect(
    page.getByRole("button", { name: "Next captured day" }),
  ).toBeDisabled();
});

test("shows the empty day and the uncaptured chart", async ({
  page,
  context,
}) => {
  await page.goto(`/charts?view=table&date=${utcDaysAgo(4)}`);
  await expect(
    page.getByText(`No capture of this chart on ${formatDay(utcDaysAgo(4))}`),
  ).toBeVisible();

  await context.addCookies([
    {
      name: "e2e_chart_uncaptured",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/charts?view=table");
  await expect(
    page.getByText("This chart has not been captured yet"),
  ).toBeVisible();
});

test("filters the rows in the browser", async ({ page }) => {
  await page.goto("/charts?view=table");

  await page
    .getByRole("textbox", { name: "Search apps" })
    .fill(TOP_CHART_APPS[2].title);

  await expect(chartTable(page).locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText(/1\s+of\s+10\s+apps/)).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(chartTable(page).locator("tbody tr")).toHaveCount(10);
});

test("is reachable from the sidebar and the palette", async ({ page }) => {
  await page.goto("/");

  const link = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Top charts" });
  await link.click();
  await expect(page).toHaveURL(/\/charts$/);
  await expect(link).toHaveAttribute("aria-current", "page");

  await page.goto("/settings");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("option", { name: "Top charts" }).click();
  await expect(page).toHaveURL(/\/charts$/);
});

test("shows each row's movement", async ({ page }) => {
  await page.goto("/charts?view=table");
  const rows = chartTable(page).locator("tbody tr");

  await expect(rows.nth(0)).toContainText("Up 2 from #3");
  await expect(rows.nth(0).locator("svg.lucide-arrow-up")).toBeVisible();
  await expect(rows.nth(1)).toContainText("Down 1 from #1");
  await expect(rows.nth(2)).toContainText("No change");
  await expect(rows.nth(3).getByText("New", { exact: true })).toBeVisible();
});

test("compares against the chosen window", async ({ page }) => {
  await page.goto("/charts?view=table");
  const request = page.waitForRequest(/\/charts\?.*compare=7d/);

  await pick(page, "Filter by compare", "vs 7 days ago");

  await expect(page).toHaveURL(/compare=7d/);
  await request;
  await expect(
    page.getByText(`vs ${formatDayMonth(TOP_CHART_DATES[1])}`, { exact: true }),
  ).toBeVisible();
});

test("lists the trending apps", async ({ page }) => {
  await page.goto("/charts?view=table");
  const trending = page.getByRole("tablist", { name: "Trending list" });

  await expect(trending.getByRole("tab", { name: /Climbers/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("listitem")).toHaveCount(2);
  await expect(panel).toContainText(TOP_CHART_APPS[7].title);

  await trending.getByRole("tab", { name: /Dropped out/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Was #4");

  await page.goto("/charts?view=table&compare=30d");
  await expect(
    page.getByText("Capture more days to see movement."),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Trending list" }),
  ).toHaveCount(0);
});

test("sorts by movement", async ({ page }) => {
  await page.goto("/charts?view=table");

  await page.getByRole("button", { name: "Change" }).click();

  await expect(page).toHaveURL(/sort=movement/);
  await expect(chartTable(page).locator("tbody tr").first()).toContainText(
    "New entry",
  );
});

const MOCK_API = "http://localhost:4100";

test("captures today", async ({ page, request }) => {
  await request.get(`${MOCK_API}/__forget-chart-captures/6014`);
  await page.goto(`/charts?view=table&genre=6014&date=${TOP_CHART_DATES[2]}`);

  await page.getByRole("button", { name: "Capture today" }).click();

  await expect(page.getByText("Captured today's chart")).toBeVisible();
  await expect(page).not.toHaveURL(/date=/);
  await expect(chartTable(page).locator("caption")).toContainText(
    formatDay(utcDaysAgo(0)),
  );
  await expect(page.getByRole("button", { name: "Capture today" })).toHaveCount(
    0,
  );
  const captures = (await (
    await request.get(`${MOCK_API}/__chart-captures`)
  ).json()) as Array<Record<string, string>>;
  expect(captures).toContainEqual({
    store: "APP_STORE",
    country: "us",
    collection: "free",
    genre: "6014",
    device: "iphone",
  });
});

test("shows today's capture while comparing an older window", async ({
  page,
  request,
}) => {
  await request.get(`${MOCK_API}/__forget-chart-captures/6000`);
  await page.goto("/charts?view=table&genre=6000&compare=7d");

  await page.getByRole("button", { name: "Capture today" }).click();

  await expect(page.getByText("Captured today's chart")).toBeVisible();
  await expect(page).toHaveURL(/compare=7d/);
  await expect(chartTable(page).locator("caption")).toContainText(
    formatDay(utcDaysAgo(0)),
  );
});

test("offers a capture only when the api has no capture for its day", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "e2e_chart_api_day",
      value: TOP_CHART_DATES[0],
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/charts?view=table");

  await expect(
    page.getByRole("button", { name: "Follow category" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Capture today" })).toHaveCount(
    0,
  );
});

test("a spent allowance is shown", async ({ page, context }) => {
  await context.addCookies([
    {
      name: "e2e_chart_capture_spent",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/charts?view=table");

  await page.getByRole("button", { name: "Capture today" }).click();

  await expect(page.getByText(/Chart capture limit reached/)).toBeVisible();
});

test.describe.serial("chart follows", () => {
  const follows = async (request: APIRequestContext) =>
    (await (await request.get(`${MOCK_API}/__chart-follows`)).json()) as Array<
      Record<string, string>
    >;
  const followChart = (
    request: APIRequestContext,
    key: Record<string, string>,
  ) => request.post(`${MOCK_API}/charts/follows`, { data: key });

  test("follows the three kinds of a category and unfollows them", async ({
    page,
    request,
  }) => {
    await request.get(`${MOCK_API}/__reset-chart-follows`);
    await page.goto("/charts?view=table&genre=7012");

    await page.getByRole("button", { name: "Follow category" }).click();

    await expect(
      page.getByText(/^Following Puzzle · United States/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();
    expect(
      (await follows(request)).map(
        (follow) => `${follow.collection}:${follow.genre}`,
      ),
    ).toEqual(["free:7012", "paid:7012", "grossing:7012"]);

    await page.getByRole("button", { name: "Following" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Stop following this category?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Stop following" }).click();

    await expect(page.getByText("Stopped following")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Follow category" }),
    ).toBeVisible();
    expect(await follows(request)).toEqual([]);
  });

  test("completes a category followed in part", async ({ page, request }) => {
    await request.get(`${MOCK_API}/__reset-chart-follows`);
    const seeded = (await (
      await followChart(request, {
        store: "APP_STORE",
        country: "us",
        collection: "paid",
        genre: "7012",
        device: "iphone",
      })
    ).json()) as Record<string, string>;
    await page.goto("/charts?view=table&genre=7012");

    await page.getByRole("button", { name: "Follow category" }).click();

    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();
    const rows = await follows(request);
    expect(rows.map((follow) => follow.collection).sort()).toEqual([
      "free",
      "grossing",
      "paid",
    ]);
    expect(rows.find((follow) => follow.collection === "paid")?.id).toBe(
      seeded.id,
    );
  });

  test("a full follow quota is shown", async ({ page, context, request }) => {
    await request.get(`${MOCK_API}/__reset-chart-follows`);
    await context.addCookies([
      {
        name: "e2e_chart_follow_limit",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/charts?view=table&genre=7012");

    await page.getByRole("button", { name: "Follow category" }).click();

    await expect(page.getByText(/follow.* limit reached/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Follow category" }),
    ).toBeEnabled();
    expect(await follows(request)).toEqual([]);
  });

  test("lists one entry per followed category", async ({ page, request }) => {
    await request.get(`${MOCK_API}/__reset-chart-follows`);
    for (const collection of ["free", "paid", "grossing"]) {
      await followChart(request, {
        store: "APP_STORE",
        country: "us",
        collection,
        genre: "6014",
        device: "iphone",
      });
    }
    await page.goto("/charts?view=table");

    await page.getByRole("button", { name: "Followed charts" }).click();

    const list = page.getByRole("dialog", { name: "Followed charts" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(
      list.getByRole("link", { name: "Games · United States" }),
    ).toContainText("Free, Paid, Grossing");
    await expect(list.getByText("1 of Unlimited")).toBeVisible();
  });

  test("lists the followed charts", async ({ page, request }) => {
    await request.get(`${MOCK_API}/__reset-chart-follows`);
    await followChart(request, {
      store: "APP_STORE",
      country: "us",
      collection: "free",
      genre: "7012",
      device: "iphone",
    });
    await followChart(request, {
      store: "GOOGLE_PLAY",
      country: "de",
      collection: "grossing",
      genre: "GAME_PUZZLE",
      device: "android",
    });
    await page.goto("/charts?view=table");

    await page.getByRole("button", { name: "Followed charts" }).click();

    const list = page.getByRole("dialog", { name: "Followed charts" });
    await expect(list).toHaveAccessibleDescription(
      "The daily run captures these every day.",
    );
    await expect(list.getByText("2 of Unlimited")).toBeVisible();
    await expect(
      list.getByRole("link", { name: "Puzzle · United States" }),
    ).toContainText("App Store · Free");
    await expect(
      list.getByRole("link", { name: "Puzzle · United States" }),
    ).toHaveAttribute(
      "href",
      "/charts?store=APP_STORE&country=us&genre=7012&device=iphone",
    );
    await expect(
      list.getByRole("link", { name: "Puzzle · Germany" }),
    ).toHaveAttribute(
      "href",
      "/charts?store=GOOGLE_PLAY&country=de&genre=GAME_PUZZLE&device=android",
    );

    await list.getByRole("link", { name: "Puzzle · Germany" }).click();

    await expect(page).toHaveURL(/store=GOOGLE_PLAY/);
    await expect(page).toHaveURL(/genre=GAME_PUZZLE/);
    await expect(list).toBeHidden();
  });

  test("stops following a chart from the list", async ({ page, request }) => {
    await request.get(`${MOCK_API}/__reset-chart-follows`);
    await followChart(request, {
      store: "APP_STORE",
      country: "us",
      collection: "free",
      genre: "7012",
      device: "iphone",
    });
    await page.goto("/charts?view=table");

    await page.getByRole("button", { name: "Followed charts" }).click();
    const list = page.getByRole("dialog", { name: "Followed charts" });
    await list
      .getByRole("button", {
        name: "Stop following Puzzle · United States",
      })
      .click();

    await expect(page.getByText("Stopped following")).toBeVisible();
    await expect(list.getByText("No categories followed yet")).toBeVisible();
    expect(await follows(request)).toEqual([]);
  });

  test("drops an unfollowed chart before the lists load again", async ({
    page,
    context,
    request,
  }) => {
    await request.get(`${MOCK_API}/__reset-chart-follows`);
    await followChart(request, {
      store: "APP_STORE",
      country: "us",
      collection: "free",
      genre: "7012",
      device: "iphone",
    });
    await page.goto("/charts?view=table&genre=7012");
    await page.getByRole("button", { name: "Followed charts" }).click();
    const list = page.getByRole("dialog", { name: "Followed charts" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await context.addCookies([
      {
        name: "e2e_api_latency",
        value: "1500",
        domain: "localhost",
        path: "/",
      },
    ]);

    await list
      .getByRole("button", {
        name: "Stop following Puzzle · United States",
      })
      .click();
    await expect(page.getByText("Stopped following")).toBeVisible();

    await expect(list.getByText("No categories followed yet")).toBeVisible({
      timeout: 1000,
    });
    await expect(
      page.getByRole("button", { name: "Follow category" }),
    ).toBeVisible({ timeout: 1000 });
  });
});

test("badges the workspace's apps", async ({ page }) => {
  await page.goto("/charts?view=table");
  const rows = chartTable(page).locator("tbody tr");

  await expect(
    rows.nth(2).getByRole("link", { name: "Yours" }),
  ).toHaveAttribute("href", "/apps/app-1");
  await expect(
    rows.nth(4).getByRole("link", { name: "Competitor of Focus Timer" }),
  ).toHaveAttribute("href", "/apps/app-1/competitors");
  await expect(rows.nth(2).getByRole("button", { name: /^Add / })).toHaveCount(
    0,
  );
  await expect(rows.nth(4).getByRole("button", { name: /^Add / })).toHaveCount(
    0,
  );
  await expect(
    rows.nth(0).getByRole("button", {
      name: `Add ${TOP_CHART_APPS[0].title} as competitor`,
    }),
  ).toBeVisible();
});

test("adds a row as a competitor", async ({ page, request }) => {
  await page.goto("/charts?view=table");
  const row = TOP_CHART_APPS[0];
  const posted = page.waitForRequest(
    (sent) =>
      sent.method() === "POST" &&
      sent.url().endsWith("/apps/app-1/competitors"),
  );

  await page
    .getByRole("button", { name: `Add ${row.title} as competitor` })
    .click();
  await page.getByRole("menuitem", { name: "Focus Timer" }).click();

  expect((await posted).postDataJSON()).toEqual({ url: row.storeAppId });
  await expect(page.getByText(/^Now tracking/)).toBeVisible();
  await request.post(`${MOCK_API}/__reset/competitors/app-1`);
});

test("shows the add in progress on the competitor menu", async ({
  page,
  context,
  request,
}) => {
  await page.goto("/charts?view=table");
  await context.addCookies([
    { name: "e2e_api_latency", value: "1500", domain: "localhost", path: "/" },
  ]);
  const row = TOP_CHART_APPS[0];
  const menu = page.getByRole("button", {
    name: `Add ${row.title} as competitor`,
  });

  await menu.click();
  await page.getByRole("menuitem", { name: "Focus Timer" }).click();

  await expect(menu).toHaveAttribute("aria-busy", "true");
  await expect(menu.locator(".animate-spin")).toBeVisible();
  await expect(page.getByText(/^Now tracking/)).toBeVisible();
  await request.post(`${MOCK_API}/__reset/competitors/app-1`);
});

test("hides the price column on a free chart", async ({ page }) => {
  await page.goto("/charts?view=table");
  await expect(chartTable(page).locator("tbody tr")).toHaveCount(
    TOP_CHART_APPS.length,
  );
  await expect(
    chartTable(page).getByRole("columnheader", { name: "Price" }),
  ).toHaveCount(0);

  await page.goto("/charts?view=table&collection=paid");

  await expect(
    chartTable(page).getByRole("columnheader", { name: "Price" }),
  ).toBeVisible();
});

test("shows a dash for an unchanged row", async ({ page }) => {
  await page.goto("/charts?view=table");
  const unchanged = chartTable(page)
    .locator("tbody tr")
    .filter({ hasText: "Word Garden" });

  const change = unchanged.getByRole("cell").nth(1);
  await expect(change).toContainText("—");
  await expect(change).toContainText("No change");
  await expect(change).not.toContainText("from #");
});

test("offers the row actions in a column", async ({ page }) => {
  await page.goto("/charts");
  const first = kindRegion(page, "Free").getByRole("listitem").first();

  await expect(
    first.getByRole("button", {
      name: `Add ${TOP_CHART_APPS[0].title} as competitor`,
    }),
  ).toBeVisible();
  await expect(
    first.getByRole("link", {
      name: `Open ${TOP_CHART_APPS[0].title} in the store`,
    }),
  ).toBeVisible();
  await expect(
    kindRegion(page, "Free")
      .getByRole("listitem")
      .nth(2)
      .getByRole("link", { name: "Yours" }),
  ).toBeVisible();
});

test("leaves out the category column when no row has one", async ({ page }) => {
  await page.goto("/charts?view=table&store=GOOGLE_PLAY");

  await expect(chartTable(page).locator("tbody tr")).toHaveCount(
    TOP_CHART_APPS.length,
  );
  await expect(
    chartTable(page).getByRole("columnheader", { name: "Category" }),
  ).toHaveCount(0);

  await page.goto("/charts?view=table");

  await expect(
    chartTable(page).getByRole("columnheader", { name: "Category" }),
  ).toHaveCount(1);
});

test("names every chosen filter before hydration", async ({ page }) => {
  await page.route("**/_next/static/chunks/**", (route) => route.abort());
  await page.goto("/charts?view=table&country=de&genre=6014");

  await expect(page.getByRole("combobox", { name: "Country" })).toHaveText(
    "DE · Germany",
  );
  await expect(page.getByRole("combobox", { name: "Category" })).toHaveText(
    "Games",
  );
});

test("opens the store", async ({ page }) => {
  await page.goto("/charts?view=table");

  await expect(
    page.getByRole("link", {
      name: `Open ${TOP_CHART_APPS[0].title} in the store`,
    }),
  ).toHaveAttribute(
    "href",
    `https://apps.apple.com/us/app/id${TOP_CHART_APPS[0].storeAppId}`,
  );
});

test("keeps the row actions on the chart on screen while the next one loads", async ({
  page,
  context,
}) => {
  await page.goto("/charts?view=table");
  await context.addCookies([
    { name: "e2e_api_latency", value: "4000", domain: "localhost", path: "/" },
  ]);

  await page
    .getByRole("tablist", { name: "Store" })
    .getByRole("tab", { name: "Google Play" })
    .click();

  await expect(page).toHaveURL(/store=GOOGLE_PLAY/);
  await expect(
    page.getByRole("button", {
      name: `Add ${TOP_CHART_APPS[0].title} as competitor`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: `Add ${TOP_CHART_APPS[0].title} to Tomato Clock`,
    }),
  ).toHaveCount(0);
});

test("marks the chosen day apart from the other captured days", async ({
  page,
}) => {
  await page.goto("/charts?view=table");

  await page.getByRole("button", { name: /^Captured day/ }).click();
  const chosen = page.locator('[data-captured][aria-pressed="true"]');
  const other = page.locator('[data-captured][aria-pressed="false"]').first();
  await expect(chosen).toHaveCount(1);
  const background = (locator: typeof chosen) =>
    locator.evaluate((element) => getComputedStyle(element).backgroundColor);
  const fill = (className: string) =>
    page.evaluate((name) => {
      const probe = document.createElement("span");
      probe.className = name;
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    }, className);

  expect(await background(chosen)).toBe(await fill("bg-primary"));
  expect(await background(other)).toBe(await fill("bg-secondary"));
});

test("moves through captured days with the keyboard from a day without one", async ({
  page,
}) => {
  await page.goto(`/charts?view=table&date=${utcDaysAgo(4)}`);

  const trigger = page.getByRole("button", { name: /^Captured day/ });
  await expect(trigger).toHaveAccessibleName(
    `Captured day, ${formatDay(utcDaysAgo(4))}`,
  );
  await trigger.click();
  const focused = page.locator(":focus");
  await expect(focused).toHaveAttribute("data-captured", "true");
  await expect(focused).toBeEnabled();

  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(new RegExp(`date=${TOP_CHART_DATES[4]}`));
});
