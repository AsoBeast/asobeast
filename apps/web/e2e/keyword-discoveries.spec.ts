import AxeBuilder from "@axe-core/playwright";
import type { Page, Request } from "@playwright/test";
import { pressFromKeyboard } from "./held-request.mts";
import { activateTwiceInOneTask, hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { APP_GP_DETAIL, APP_RIVAL_ID } from "./fixtures.mts";
import {
  DISCOVERY_FAIL_WRITE_COOKIE,
  DISCOVERY_NONE_COOKIE,
  DISCOVERY_PAGED_APP,
  DISCOVERY_PENDING_COOKIE,
  DISCOVERY_REFRESH_QUEUED,
  DISCOVERY_REFUSE_COOKIE,
  DISCOVERY_SPENT_COOKIE,
  DISCOVERY_UNFIT_COOKIE,
} from "./keyword-discoveries.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const KEYWORDS = "/apps/app-1/keywords";
const DISCOVERED = `${KEYWORDS}?tab=discovered`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  for (const id of ["app-1", APP_GP_DETAIL.id, DISCOVERY_PAGED_APP]) {
    await request.post(`${MOCK_API_URL}/__reset/keyword-discoveries/${id}`, {
      failOnStatusCode: true,
    });
  }
});

const cookie = (name: string) => ({
  name,
  value: "1",
  domain: "localhost",
  path: "/",
});

const lists = (page: Page) =>
  page.getByRole("tablist", { name: "Keyword lists" });

const states = (page: Page) =>
  page.getByRole("tablist", { name: "Discovered keyword states" });

const table = (page: Page) =>
  page.getByRole("table", { name: /Keyword discoveries/ });

const keywordsIn = (page: Page) => table(page).getByRole("rowheader");

const rowOf = (page: Page, keyword: string) =>
  table(page)
    .getByRole("row")
    .filter({
      has: page.getByRole("rowheader", { name: new RegExp(`^${keyword}`) }),
    });

const discoveryReads = (page: Page): Request[] => {
  const reads: Request[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      /\/apps\/app-1\/keyword-discoveries(\?|$)/.test(request.url())
    ) {
      reads.push(request);
    }
  });
  return reads;
};

test("the keyword lists switch between tracked and discovered through the url", async ({
  page,
}) => {
  await page.goto(KEYWORDS);

  const tracked = lists(page).getByRole("tab", { name: "Tracked 5" });
  const discovered = lists(page).getByRole("tab", { name: /^Discovered 9/ });
  await expect(tracked).toHaveAttribute("aria-selected", "true");
  await expect(discovered).toHaveAttribute(
    "aria-label",
    "Discovered 9, new discoveries to review",
  );
  await expect(
    page.getByRole("heading", { name: "Tracked keywords" }),
  ).toBeVisible();

  await discovered.click();

  await expect(page).toHaveURL(/[?&]tab=discovered/);
  await expect(discovered).toHaveAttribute("aria-selected", "true");
  await expect(discovered).not.toHaveAttribute("aria-label");
  await expect(
    page.getByRole("heading", { name: "Discovered keywords" }),
  ).toBeVisible();
  await expect(table(page)).toBeVisible();

  await tracked.click();

  await expect(page).not.toHaveURL(/tab=/);
  await expect(
    page.getByRole("heading", { name: "Tracked keywords" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: /Tracked keywords/ }),
  ).toBeVisible();
});

test("a competitor's keywords page offers no discoveries", async ({ page }) => {
  const reads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/keyword-discoveries"))
      reads.push(request.url());
  });
  await page.goto(`/apps/${APP_RIVAL_ID}/keywords?tab=discovered`);

  await expect(
    page.getByRole("heading", { name: "Tracked keywords" }),
  ).toBeVisible();
  await expect(lists(page)).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(reads).toEqual([]);
});

test("a deep link opens one state of the discovered list", async ({ page }) => {
  await page.goto(`${DISCOVERED}&state=ranked`);

  await expect(
    states(page).getByRole("tab", { name: "Ranked 3" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(keywordsIn(page)).toHaveText([
    /^focus timer app/,
    /^pomodoro clock/,
    /^deep work/,
  ]);
});

test("the state tabs filter the one list in the browser", async ({ page }) => {
  const reads = discoveryReads(page);
  await page.goto(DISCOVERED);
  await expect(keywordsIn(page)).toHaveCount(9);
  const before = reads.length;

  await states(page).getByRole("tab", { name: "Opportunities 1" }).click();

  await expect(page).toHaveURL(/state=opportunity/);
  await expect(keywordsIn(page)).toHaveText([/^study planner/]);

  await states(page).getByRole("tab", { name: "All 9" }).click();

  await expect(page).not.toHaveURL(/state=/);
  await expect(keywordsIn(page)).toHaveCount(9);
  expect(reads.length).toBe(before);
});

test("each row names its source, rank and scores", async ({ page }) => {
  await page.goto(DISCOVERED);

  const headers = table(page).getByRole("columnheader");
  await expect(headers).toContainText([
    "Keyword",
    "Source",
    "Rank",
    "Popularity",
    "Difficulty",
    "Relevance",
    "Opportunity",
  ]);
  await expect(rowOf(page, "focus timer app")).toContainText("Your title");
  await expect(rowOf(page, "deep work")).toContainText("Competitors");
  await expect(rowOf(page, "study planner")).toContainText("Reviews");
  await expect(rowOf(page, "time blocker")).toContainText("Apple popularity");
  await expect(rowOf(page, "productivity tracker")).toContainText(
    "Your other apps",
  );
  await expect(rowOf(page, "concentration")).toContainText("Your description");

  await expect(rowOf(page, "focus timer app")).toContainText("Rank 3");
  await expect(rowOf(page, "deep work")).toContainText("Rank 120");
  await expect(rowOf(page, "study planner")).toContainText(
    "Not found in the top 200",
  );
  await expect(rowOf(page, "concentration")).toContainText(
    "Not found in the top 50",
  );
  await expect(rowOf(page, "work sprint")).toContainText("Not checked yet");
  await expect(table(page)).not.toContainText("Rank 0");

  await expect(rowOf(page, "study planner")).toContainText(
    "Opportunity 41, fair",
  );
  await expect(rowOf(page, "time blocker")).toContainText("Popularity 70");
  await expect(rowOf(page, "time blocker")).toContainText(
    "No difficulty score",
  );
  await expect(
    rowOf(page, "focus timer app").getByText("Recommended"),
  ).toBeVisible();
});

test("the market pills scope the list and its counts", async ({ page }) => {
  await page.goto(DISCOVERED);

  await page
    .getByRole("group", { name: "Keyword markets" })
    .getByRole("button", { name: /^PL/ })
    .click();

  await expect(page).toHaveURL(/country=pl/);
  await expect(page).toHaveURL(/tab=discovered/);
  await expect(keywordsIn(page)).toHaveText([
    /^minutnik skupienia/,
    /^timer do nauki/,
  ]);
  await expect(
    states(page).getByRole("tab", { name: "Ranked 1" }),
  ).toBeVisible();
  await expect(
    lists(page).getByRole("tab", { name: /^Discovered 2/ }),
  ).toBeVisible();
});

test("a google play app names its short description", async ({ page }) => {
  await page.goto(`/apps/${APP_GP_DETAIL.id}/keywords?tab=discovered`);

  await expect(rowOf(page, "daily focus")).toContainText(
    "Your short description",
  );
  await expect(table(page)).not.toContainText("Apple popularity");
});

test("a long list pages fifty rows at a time and marks the best fifty", async ({
  page,
}) => {
  await page.goto(`/apps/${DISCOVERY_PAGED_APP}/keywords?tab=discovered`);

  await expect(keywordsIn(page)).toHaveCount(50);
  await expect(page.getByText("Showing 50 of 120")).toBeVisible();

  await page.getByRole("button", { name: "Show 50 more" }).click();

  await expect(keywordsIn(page)).toHaveCount(100);
  await expect(
    rowOf(page, "discovered phrase 050").getByText("Recommended"),
  ).toBeVisible();
  await expect(
    rowOf(page, "discovered phrase 051").getByText("Recommended"),
  ).toHaveCount(0);
});

test("loading the last page hands focus to the first row it reveals", async ({
  page,
}) => {
  await page.goto(`/apps/${DISCOVERY_PAGED_APP}/keywords?tab=discovered`);

  await pressFromKeyboard(page.getByRole("button", { name: "Show 50 more" }));
  await expect(keywordsIn(page)).toHaveCount(100);
  const last = page.getByRole("button", { name: "Show 20 more" });
  await expect(last).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(keywordsIn(page)).toHaveCount(120);
  await expect(
    page.getByRole("checkbox", { name: "Select discovered phrase 101" }),
  ).toBeFocused();
});

test("the footer says when the list was checked and what the week holds", async ({
  page,
}) => {
  await page.goto(DISCOVERED);

  await expect(
    page.getByText(
      /^Checked 3 days ago\. 40 checks a week, 12 used; the next run is on Monday\.$/,
    ),
  ).toBeVisible();
});

test("a list that never ran says when discovery runs", async ({
  page,
  context,
}) => {
  await context.addCookies([cookie(DISCOVERY_NONE_COOKIE)]);
  await page.goto(DISCOVERED);

  await expect(page.getByText("No discoveries yet")).toBeVisible();
  await expect(
    page.getByText(
      /^Not checked yet\. 40 checks a week; the next run is on Monday\.$/,
    ),
  ).toBeVisible();
  await expect(table(page)).toHaveCount(0);
});

test("an empty state names its reason and offers every row", async ({
  page,
}) => {
  await page.goto(`${DISCOVERED}&country=gb&state=ranked`);

  await expect(page.getByText("Nothing ranked yet")).toBeVisible();
  await page.getByRole("button", { name: "Show all" }).click();

  await expect(page).not.toHaveURL(/state=/);
  await expect(page.getByText("Nothing to review")).toBeVisible();
});

test("Show all keeps focus on the panel when its empty state leaves", async ({
  page,
}) => {
  await page.goto(`${DISCOVERED}&state=ranked&country=gb`);

  await pressFromKeyboard(page.getByRole("button", { name: "Show all" }));

  await expect(page.getByText("Nothing to review")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Discovered keywords" }),
  ).toBeFocused();
});

test("pending checks poll until they land", async ({ page, context }) => {
  await context.addCookies([cookie(DISCOVERY_PENDING_COOKIE)]);
  await page.clock.install();
  const reads = discoveryReads(page);
  await page.goto(DISCOVERED);
  await expect(page.getByText("3 checks pending")).toBeVisible();
  await hydrated(
    page.getByRole("button", { name: "Refresh discoveries", exact: true }),
  );

  await page.clock.runFor(16_000);

  await expect(page.getByText("3 checks pending")).toBeHidden({
    timeout: 15_000,
  });
  const settled = reads.length;
  await page.clock.runFor(60_000);
  expect(reads.length).toBe(settled);
});

test("the pending spinner holds still under reduced motion", async ({
  page,
  context,
}) => {
  await context.addCookies([cookie(DISCOVERY_PENDING_COOKIE)]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(DISCOVERED);

  const pending = page.getByText("3 checks pending");
  await expect(pending).toBeVisible();
  const spinner = page.locator("p").filter({ has: pending }).locator("svg");
  await expect(spinner).toHaveCount(1);
  expect(
    await spinner.evaluate(
      (element) => getComputedStyle(element).animationName,
    ),
  ).toBe("none");
});

test("the discovered list fits a narrow screen", async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(DISCOVERED);
    await expect(table(page)).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("region", { name: "Keyword discoveries" }),
    ).toBeVisible();
  }
});

const writes = (page: Page, action: string): unknown[] => {
  const bodies: unknown[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      request.url().endsWith(`/apps/app-1/keyword-discoveries/${action}`)
    ) {
      bodies.push(request.postDataJSON() ?? null);
    }
  });
  return bodies;
};

const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text });

const control = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

test.describe("discovery actions", () => {
  test("tracking a row removes it and lowers the counts", async ({ page }) => {
    const bodies = writes(page, "track");
    await page.goto(DISCOVERED);
    const track = await hydrated(control(page, "Track pomodoro clock"));

    await track.click();

    await expect(toast(page, "Tracking 1 keyword")).toBeVisible();
    await expect(rowOf(page, "pomodoro clock")).toHaveCount(0);
    await expect(
      lists(page).getByRole("tab", { name: /^Discovered 8/ }),
    ).toBeVisible();
    await expect(
      states(page).getByRole("tab", { name: "Ranked 2" }),
    ).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect(bodies).toEqual([{ keywordIds: ["disc-app-1-us-pomodoro-clock"] }]);
  });

  test("dismissing a row removes it", async ({ page }) => {
    const bodies = writes(page, "dismiss");
    await page.goto(DISCOVERED);

    await (await hydrated(control(page, "Dismiss deep work"))).click();

    await expect(rowOf(page, "deep work")).toHaveCount(0);
    await expect(
      states(page).getByRole("tab", { name: "All 8" }),
    ).toBeVisible();
    expect(bodies).toHaveLength(1);
  });

  test("a double click tracks once", async ({ page }) => {
    const bodies = writes(page, "track");
    await page.goto(DISCOVERED);

    await activateTwiceInOneTask(
      await hydrated(control(page, "Track work sprint")),
    );

    await expect(rowOf(page, "work sprint")).toHaveCount(0);
    expect(bodies).toHaveLength(1);
  });

  test("the selected rows are tracked in one request", async ({ page }) => {
    const bodies = writes(page, "track");
    await page.goto(DISCOVERED);
    const trackSelected = control(page, "Track selected (0)");
    await expect(trackSelected).toHaveAttribute("aria-disabled", "true");

    for (const keyword of ["deep work", "concentration", "focus music"]) {
      await (
        await hydrated(
          page.getByRole("checkbox", { name: `Select ${keyword}` }),
        )
      ).check();
    }
    await control(page, "Track selected (3)").click();

    await expect(toast(page, "Tracking 3 keywords")).toBeVisible();
    await expect(keywordsIn(page)).toHaveCount(6);
    await expect(control(page, "Track selected (0)")).toBeVisible();
    expect(bodies).toHaveLength(1);
    expect((bodies[0] as { keywordIds: string[] }).keywordIds).toHaveLength(3);
  });

  test("the recommended rows are tracked together", async ({ page }) => {
    const bodies = writes(page, "track");
    await page.goto(DISCOVERED);

    await (await hydrated(control(page, "Track recommended (9)"))).click();

    await expect(toast(page, "Tracking 9 keywords")).toBeVisible();
    expect((bodies[0] as { keywordIds: string[] }).keywordIds).toHaveLength(9);
  });

  test("every ranked row of the market is tracked by one request", async ({
    page,
  }) => {
    const bodies = writes(page, "track");
    await page.goto(DISCOVERED);

    await (await hydrated(control(page, "Track all ranked (3)"))).click();

    await expect(toast(page, "Tracking 3 keywords")).toBeVisible();
    expect(bodies).toEqual([{ allRanked: true, country: "us" }]);
    await expect(
      states(page).getByRole("tab", { name: "Ranked 0" }),
    ).toBeVisible();
  });

  test("what did not fit the plan is named", async ({ page, context }) => {
    await context.addCookies([cookie(DISCOVERY_UNFIT_COOKIE)]);
    await page.goto(DISCOVERED);

    await expect(page.getByText("12 did not fit your plan")).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Auto-track ranked" }),
    ).toBeChecked();

    await (await hydrated(control(page, "Track all ranked (3)"))).click();

    await expect(
      toast(page, "Tracking 1 keyword. 2 did not fit your plan."),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(rowOf(page, "focus timer app")).toHaveCount(0);
    await expect(rowOf(page, "pomodoro clock")).toBeVisible();
    await expect(rowOf(page, "deep work")).toBeVisible();
    await expect(
      states(page).getByRole("tab", { name: "Ranked 2" }),
    ).toBeVisible();
  });

  test("auto tracking keeps focus and tracks the ranked rows", async ({
    page,
  }) => {
    const bodies = writes(page, "settings");
    await page.goto(DISCOVERED);
    const toggle = await hydrated(
      page.getByRole("switch", { name: "Auto-track ranked" }),
    );
    await expect(toggle).not.toBeChecked();

    await toggle.focus();
    await page.keyboard.press("Space");

    await expect(toggle).toBeChecked();
    await expect(toast(page, "Tracking 4 keywords")).toBeVisible();
    await expect(
      states(page).getByRole("tab", { name: "Ranked 0" }),
    ).toBeVisible();
    await expect(toggle).toBeFocused();
    expect(bodies).toEqual([{ autoTrackRanked: true }]);
  });

  test("a refresh queues checks and polls for them", async ({ page }) => {
    const bodies = writes(page, "refresh");
    await page.goto(DISCOVERED);

    await (await hydrated(control(page, "Refresh discoveries"))).click();

    await expect(
      toast(page, `Queued ${DISCOVERY_REFRESH_QUEUED} checks`),
    ).toBeVisible();
    await expect(
      page.getByText(`${DISCOVERY_REFRESH_QUEUED} checks pending`),
    ).toBeVisible();
    expect(bodies).toHaveLength(1);
  });

  test("a refresh under auto track also reloads the tracked keywords", async ({
    page,
    context,
  }) => {
    await context.addCookies([cookie(DISCOVERY_UNFIT_COOKIE)]);
    await page.goto(DISCOVERED);
    const refresh = await hydrated(control(page, "Refresh discoveries"));
    const trackedReload = page.waitForRequest(
      (request) =>
        request.method() === "GET" &&
        /\/api\/backend\/apps\/app-1\/keywords(\?|$)/.test(request.url()),
    );

    await refresh.click();

    await trackedReload;
  });

  test("a refresh with no checks left says the list was refreshed", async ({
    page,
    context,
  }) => {
    await context.addCookies([cookie(DISCOVERY_SPENT_COOKIE)]);
    await page.goto(DISCOVERED);

    await (await hydrated(control(page, "Refresh discoveries"))).click();

    await expect(
      toast(
        page,
        "No checks to queue this week. The list was refreshed from other searches.",
      ),
    ).toBeVisible();
  });

  test("a refused refresh names the limit and stays usable", async ({
    page,
    context,
  }) => {
    await context.addCookies([cookie(DISCOVERY_REFUSE_COOKIE)]);
    await page.goto(DISCOVERED);
    const refresh = await hydrated(control(page, "Refresh discoveries"));

    await refresh.focus();
    await page.keyboard.press("Enter");

    await expect(toast(page, /^Deep search limit reached/)).toBeVisible();
    await expect(refresh).toBeFocused();
    await expect(refresh).not.toHaveAttribute("aria-disabled", "true");
  });

  test("a failed track keeps the row and its focus", async ({
    page,
    context,
  }) => {
    await context.addCookies([cookie(DISCOVERY_FAIL_WRITE_COOKIE)]);
    await page.goto(DISCOVERED);
    const track = await hydrated(control(page, "Track focus timer app"));

    await track.focus();
    await page.keyboard.press("Enter");

    await expect(toast(page, /unexpected error/i)).toBeVisible();
    await expect(rowOf(page, "focus timer app")).toHaveCount(1);
    await expect(track).toBeFocused();
    await expect(track).not.toHaveAttribute("aria-disabled", "true");
  });

  test("the controls are reached from the keyboard in order", async ({
    page,
  }) => {
    await page.goto(DISCOVERED);
    await (
      await hydrated(states(page).getByRole("tab", { name: "All 9" }))
    ).focus();

    for (const next of [
      page.getByRole("switch", { name: "Auto-track ranked" }),
      control(page, "Refresh discoveries"),
      control(page, "Track selected (0)"),
      control(page, "Track recommended (9)"),
      control(page, "Track all ranked (3)"),
    ]) {
      await page.keyboard.press("Tab");
      await expect(next).toBeFocused();
    }

    const firstRow = rowOf(page, "focus timer app");
    await firstRow.getByRole("checkbox").focus();
    for (const next of [
      control(page, "Track focus timer app"),
      control(page, "Dismiss focus timer app"),
    ]) {
      await page.keyboard.press("Tab");
      await expect(next).toBeFocused();
    }
  });

  test("the tab with a selection passes axe", async ({ page }) => {
    await page.goto(DISCOVERED);
    await (
      await hydrated(page.getByRole("checkbox", { name: "Select deep work" }))
    ).check();

    const { violations } = await new AxeBuilder({ page })
      .include("main")
      .analyze();

    expect(violations.map(({ id }) => id)).toEqual([]);
  });
});
