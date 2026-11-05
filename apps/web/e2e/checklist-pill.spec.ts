import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { THEMES } from "./contrast-check.mts";
import { holdRequest } from "./held-request.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { seedChecklist } from "./workspace-checklist.mts";

const PILL_NAME = /done in the setup checklist$/;

const pill = (page: Page) => page.getByRole("button", { name: PILL_NAME });
const popover = (page: Page) =>
  page.getByRole("dialog", { name: "Setup checklist" });
const steps = (page: Page) =>
  popover(page).getByRole("list", { name: "Checklist steps" });
const stepRows = (page: Page) => steps(page).locator(":scope > li");
const row = (page: Page, title: string) =>
  stepRows(page).filter({ hasText: title });

async function openPill(page: Page, path = "/apps/app-1"): Promise<void> {
  await page.goto(path);
  await (await hydrated(pill(page))).click();
  await expect(popover(page)).toBeVisible();
}

const pillWidth = async (page: Page) =>
  (await pill(page).boundingBox())?.width ?? 0;

const overflows = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test("the pill stays hidden without a scenario", async ({ page }) => {
  await page.goto("/apps/app-1");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await expect(pill(page)).toHaveCount(0);
});

test("the pill names its progress and floats at the bottom right", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");

  const button = await hydrated(
    page.getByRole("button", {
      name: "2 of 8 done in the setup checklist",
      exact: true,
    }),
  );
  await expect(button).toContainText("2 of 8 done");
  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(viewport.width - (box.x + box.width)).toBeLessThanOrEqual(32);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
  const container = button.locator(
    "xpath=ancestor::div[contains(@class,'fixed')][1]",
  );
  await expect(container).toHaveCSS("position", "fixed");
});

test("the popover lists the steps in order with the next one marked", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  const items = stepRows(page);
  await expect(items).toHaveCount(8);
  await expect(items.first()).toContainText("Import an app");
  await expect(row(page, "Import an app")).toContainText("Done");
  await expect(row(page, "Add a competitor")).toContainText("Done");
  await expect(row(page, "Track keywords in a second market")).toContainText(
    "Next",
  );
  await expect(steps(page).getByText("Next", { exact: true })).toHaveCount(1);
});

test("each open step links to the page that does it", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  await expect(
    popover(page).getByRole("link", { name: "Add a market" }),
  ).toHaveAttribute("href", "/apps/app-1/keywords");
  await expect(
    popover(page).getByRole("link", { name: "Connect a console" }),
  ).toHaveAttribute("href", "/integrations#store-connections");
  await expect(
    popover(page).getByRole("link", { name: "Open reviews" }),
  ).toHaveAttribute(
    "href",
    "/apps/app-1/reviews?replyState=needs_reply&sort=lowest",
  );

  await popover(page).getByRole("link", { name: "Add a market" }).click();
  await expect(page).toHaveURL(/\/apps\/app-1\/keywords$/);
  await expect(popover(page)).toHaveCount(0);
});

test("the keyboard opens and closes the popover on the pill", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");
  const button = await hydrated(pill(page));

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(popover(page)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.activeElement?.closest('[role="dialog"]') !== null &&
          document.activeElement !== document.body,
      ),
    )
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(popover(page)).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("a fresh workspace asks for an app first", async ({ page, context }) => {
  await seedChecklist(context, "fresh");
  await openPill(page);

  await expect(pill(page)).toHaveAccessibleName(
    "0 of 7 done in the setup checklist",
  );
  await expect(row(page, "Add a competitor")).toContainText(
    "Import an app first",
  );
  await expect(row(page, "Add a competitor").getByRole("link")).toHaveCount(0);
  await expect(
    popover(page).getByRole("link", { name: "Import an app" }),
  ).toHaveAttribute("href", "/");
});

test("a complete checklist shows no pill", async ({ page, context }) => {
  await seedChecklist(context, "complete");
  await page.goto("/apps/app-1");
  await expect(page.getByRole("heading").first()).toBeVisible();

  await expect(pill(page)).toHaveCount(0);
});

for (const [scenario, missing] of [
  ["play-only", "Fill your keyword field"],
  ["no-console", "Connect a store console"],
  ["no-reviews", "Reply to a review"],
] as const) {
  test(`${scenario} leaves out ${missing}`, async ({ page, context }) => {
    await seedChecklist(context, scenario);
    await openPill(page);

    await expect(stepRows(page)).toHaveCount(7);
    await expect(row(page, missing)).toHaveCount(0);
    await expect(pill(page)).toHaveAccessibleName(/ of 7 done/);
  });
}

test("the pill shrinks, remembers it and expands again", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  await popover(page).getByRole("button", { name: "Shrink the pill" }).click();
  await expect.poll(() => pillWidth(page)).toBeLessThanOrEqual(40);
  await expect(pill(page)).toHaveAccessibleName(
    "2 of 8 done in the setup checklist",
  );

  await page.reload();
  await expect(await hydrated(pill(page))).toBeVisible();
  await expect.poll(() => pillWidth(page)).toBeLessThanOrEqual(40);

  await pill(page).click();
  await popover(page).getByRole("button", { name: "Expand the pill" }).click();
  await expect.poll(() => pillWidth(page)).toBeGreaterThan(80);
});

test("the pill announces nothing at load", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");
  const button = await hydrated(pill(page));

  const status = button.locator(
    "xpath=ancestor::div[contains(@class,'fixed')][1]//*[@role='status']",
  );
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText("");
});

for (const width of [320, 375]) {
  test(`the pill and its popover fit at ${width} px`, async ({
    page,
    context,
  }) => {
    await seedChecklist(context, "partial");
    await page.setViewportSize({ width, height: 740 });
    await openPill(page);

    expect(await overflows(page)).toBe(false);
    const box = await popover(page).boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
    }

    await popover(page)
      .getByRole("button", { name: "Shrink the pill" })
      .click();
    await page.keyboard.press("Escape");
    expect(await overflows(page)).toBe(false);
  });
}

test("the pill is left out of print", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1");
  const button = await hydrated(pill(page));

  await page.emulateMedia({ media: "print" });
  await expect(button).toBeHidden();
});

test("an open popover is left out of print", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  await page.emulateMedia({ media: "print" });
  await expect(page.locator('[data-slot="popover-content"]')).toBeHidden();
});

async function refetchOnReturn(page: Page): Promise<void> {
  await page.clock.fastForward("01:05");
  await page.evaluate(() => {
    window.dispatchEvent(new Event("visibilitychange"));
  });
}

const switchScenario = (page: Page, scenario: string) =>
  page.context().addCookies([
    {
      name: "e2e_checklist",
      value: scenario,
      domain: "localhost",
      path: "/",
    },
  ]);

test("a refetch that removes the focused step keeps focus in the popover", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.clock.install();
  await openPill(page);
  await popover(page).getByRole("link", { name: "Open reviews" }).focus();

  await switchScenario(page, "no-reviews");
  await refetchOnReturn(page);

  await expect(
    popover(page).getByRole("link", { name: "Open reviews" }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.activeElement?.closest('[role="dialog"]') !== null &&
          document.activeElement !== document.body,
      ),
    )
    .toBe(true);
});

test("a refetch that completes the checklist hands focus to the page", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.clock.install();
  await page.goto("/apps/app-1");
  await (await hydrated(pill(page))).focus();

  await switchScenario(page, "complete");
  await refetchOnReturn(page);

  await expect(pill(page)).toHaveCount(0);
  await expect(page.locator("#main-content")).toBeFocused();
});

for (const theme of THEMES) {
  test(`the open popover has no contrast violation in the ${theme} theme`, async ({
    page,
    context,
  }) => {
    await seedChecklist(context, "partial");
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await openPill(page);

    const { violations } = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();
    expect(violations.flatMap(({ nodes }) => nodes)).toEqual([]);
  });
}

test("the bulk bar stays above the pill", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await page.goto("/apps/app-1/keywords");
  await hydrated(pill(page));

  await page
    .getByRole("checkbox", { name: /^Select / })
    .first()
    .check();
  await page
    .getByRole("group", { name: "Bulk keyword actions" })
    .getByRole("button", { name: "Tag", exact: true })
    .click();

  await expect(
    page.getByRole("dialog", { name: "Tag keywords" }),
  ).toBeVisible();
});

const checklistPatches = (page: Page): string[] => {
  const sent: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith("/workspace/checklist")
    ) {
      sent.push(request.postData() ?? "");
    }
  });
  return sent;
};

const hideDialog = (page: Page) =>
  page.getByRole("alertdialog", { name: "Hide the setup checklist?" });

async function startHiding(page: Page): Promise<void> {
  await openPill(page);
  await popover(page).getByRole("button", { name: "Hide checklist" }).click();
  await expect(hideDialog(page)).toBeVisible();
}

test("hiding asks first and sends nothing yet", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  const sent = checklistPatches(page);
  await startHiding(page);

  await expect(popover(page)).toHaveCount(0);
  await expect(hideDialog(page)).toContainText(
    "It stays hidden for everyone in this workspace",
  );
  await expect(hideDialog(page)).toContainText("Settings, Getting started");
  expect(sent).toEqual([]);
});

for (const close of ["Cancel", "Escape"] as const) {
  test(`${close} closes the hide dialog and returns focus to the pill`, async ({
    page,
    context,
  }) => {
    await seedChecklist(context, "partial");
    await startHiding(page);

    if (close === "Cancel") {
      await hideDialog(page).getByRole("button", { name: "Cancel" }).click();
    } else {
      await page.keyboard.press("Escape");
    }

    await expect(hideDialog(page)).toHaveCount(0);
    await expect(pill(page)).toBeFocused();
  });
}

test("confirming hides the pill for good and hands focus to the page", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  const sent = checklistPatches(page);
  await startHiding(page);

  await hideDialog(page)
    .getByRole("button", { name: "Hide checklist", exact: true })
    .click();

  await expect(pill(page)).toHaveCount(0);
  await expect(
    page.getByText("Setup checklist hidden. Show it again in Settings."),
  ).toBeVisible();
  await expect(page.locator("#main-content")).toBeFocused();
  expect(sent.map((body) => JSON.parse(body) as unknown)).toEqual([
    { dismissed: true },
  ]);

  await page.reload();
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(pill(page)).toHaveCount(0);
});

test("a failed hide keeps the dialog and the pill", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await context.addCookies([
    {
      name: "e2e_checklist_fail",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await startHiding(page);
  const confirm = hideDialog(page).getByRole("button", {
    name: "Hide checklist",
    exact: true,
  });

  await confirm.click();

  await expect(
    page.getByText("Could not hide the setup checklist"),
  ).toBeVisible();
  await expect(hideDialog(page)).toBeVisible();
  await expect(confirm).not.toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("button", { name: PILL_NAME, includeHidden: true }),
  ).toHaveCount(1);
});

const settingsSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Show the setup checklist" });

test("settings shows the checklist under getting started", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.goto("/settings");

  const section = page.locator("section#getting-started");
  await expect(
    section.getByRole("heading", { name: "Getting started" }),
  ).toBeVisible();
  await expect(section).toContainText("2 of 8 done");
  await expect(await hydrated(settingsSwitch(page))).toBeChecked();
});

test("the settings switch hides and shows the pill", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  const sent = checklistPatches(page);
  await page.goto("/settings");
  const toggle = await hydrated(settingsSwitch(page));

  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeFocused();
  await expect(page.locator("section#getting-started")).toContainText(
    "The checklist is hidden for everyone in this workspace.",
  );
  await expect(pill(page)).toHaveCount(0);

  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeFocused();
  await expect(await hydrated(pill(page))).toBeVisible();
  expect(sent.map((body) => JSON.parse(body) as unknown)).toEqual([
    { dismissed: true },
    { dismissed: false },
  ]);
});

test("the settings switch ignores a press while it saves", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  const sent = checklistPatches(page);
  await page.goto("/settings");
  const toggle = await hydrated(settingsSwitch(page));
  const held = await holdRequest(page, /\/workspace\/checklist$/, "PATCH");

  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Space");
  await expect(toggle).toBeFocused();

  held.release();
  await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
  await expect(toggle).not.toBeChecked();
  expect(sent).toHaveLength(1);
});

test("a failed read keeps settings and hides the pill", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await context.addCookies([
    {
      name: "e2e_checklist_read_fail",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto("/settings");

  const section = page.locator("section#getting-started");
  await expect(section).toContainText("Could not load the setup checklist.");
  await expect(section.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alerts", exact: true }),
  ).toBeVisible();
  await expect(pill(page)).toHaveCount(0);
});

const tipsOf = (page: Page, title: string) =>
  popover(page).getByRole("list", { name: `Worth knowing about ${title}` });

test("an open step lists the features beside it", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  const tips = tipsOf(page, "Track keywords in a second market").getByRole(
    "link",
  );
  await expect(tips).toHaveCount(4);
  await expect(tips.first()).toHaveAccessibleName(
    "Search a keyword exactly by putting it in quotes",
  );
  for (const tip of await tips.all()) {
    await expect(tip).toHaveAttribute("href", "/apps/app-1/keywords");
  }
});

test("a done step lists no features", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  await expect(tipsOf(page, "Import an app")).toHaveCount(0);
  await expect(tipsOf(page, "Add a competitor")).toHaveCount(0);
});

test("the documentation tip opens in a new tab", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  const docs = tipsOf(page, "Fill your keyword field").getByRole("link", {
    name: /Chinese, Japanese and Thai/,
  });
  await expect(docs).toHaveAttribute("target", "_blank");
  await expect(docs).toHaveAttribute("rel", /noreferrer/);
  await expect(docs).toHaveAttribute("rel", /noopener/);
  await expect(docs).toHaveAccessibleName(/\(opens in a new tab\)$/);
});

test("a tip navigates and closes the popover", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await openPill(page);

  await tipsOf(page, "Track keywords in a second market")
    .getByRole("link", { name: /^Open a score/ })
    .click();

  await expect(page).toHaveURL(/\/apps\/app-1\/keywords$/);
  await expect(popover(page)).toHaveCount(0);
});

test("a long popover scrolls inside while the page does not", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "fresh");
  await page.setViewportSize({ width: 320, height: 640 });
  await openPill(page);

  expect(
    await popover(page).evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  expect(await overflows(page)).toBe(false);
});

test("tab walks an open step's action and then its tips", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await openPill(page);
  const action = popover(page).getByRole("link", { name: "Add a market" });

  await action.focus();
  await page.keyboard.press("Tab");

  await expect(
    tipsOf(page, "Track keywords in a second market").getByRole("link").first(),
  ).toBeFocused();
});

const firstRunRequests = (page: Page, appId: string): string[] => {
  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(`/apps/${appId}/first-run`)) {
      sent.push(request.url());
    }
  });
  return sent;
};

test("the popover says the first positions are being checked", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "collecting");
  await openPill(page);

  const checking = popover(page).getByText(
    "Checking where your app already ranks",
  );
  await expect(checking).toBeVisible();
  await expect(checking.locator("xpath=..").getByRole("link")).toHaveCount(0);
  await expect(pill(page)).toHaveAccessibleName(
    "2 of 8 done in the setup checklist",
  );
});

test("the popover says the first positions are in", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await context.addCookies([
    { name: "e2e_history_days", value: "2", domain: "localhost", path: "/" },
  ]);
  await openPill(page);

  await expect(popover(page)).toContainText("Your first positions are in");
  await expect(
    popover(page).getByRole("link", { name: "See where it ranks" }),
  ).toHaveAttribute("href", "/apps/app-1/rankings");
  await expect(popover(page)).toContainText("2 of 8 done");
});

test("a finished first run shows no row", async ({ page, context }) => {
  await seedChecklist(context, "partial");
  await openPill(page);
  await expect(steps(page)).toBeVisible();

  await expect(popover(page)).not.toContainText("Your first positions are in");
  await expect(popover(page)).not.toContainText("Checking where your app");
});

test("the first run is read only while the popover is open", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "collecting");
  const sent = firstRunRequests(page, "app-new");
  await page.goto("/apps/app-1");
  const button = await hydrated(pill(page));
  await page.waitForLoadState("networkidle");
  expect(sent).toEqual([]);

  await button.click();
  await expect(
    popover(page).getByText("Checking where your app already ranks"),
  ).toBeVisible();
  expect(sent.length).toBeGreaterThanOrEqual(1);
});

test("a failed first run read offers a retry", async ({ page, context }) => {
  await seedChecklist(context, "collecting");
  await context.addCookies([
    { name: "e2e_first_run_fail", value: "1", domain: "localhost", path: "/" },
  ]);
  await openPill(page);
  await page.waitForLoadState("networkidle");

  await expect(popover(page)).not.toContainText("Checking where your app");
  await expect(popover(page).getByRole("alert")).toHaveText(
    "Could not check your first positions.",
    { timeout: 15_000 },
  );
  await expect(
    popover(page).getByRole("button", { name: "Retry" }),
  ).toBeVisible();
});

test("a workspace without an app reads no first run", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "fresh");
  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/first-run")) sent.push(request.url());
  });
  await openPill(page);
  await page.waitForLoadState("networkidle");

  expect(sent).toEqual([]);
  await expect(popover(page)).not.toContainText("Checking where your app");
});

test("the pill never hides the control a keyboard user focuses", async ({
  page,
  context,
}) => {
  await seedChecklist(context, "partial");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/apps/app-1/competitors");
  const pillBox = await (await hydrated(pill(page))).boundingBox();
  if (pillBox === null) throw new Error("the pill has no box");

  const covered: string[] = [];
  for (let stop = 0; stop < 40; stop += 1) {
    await page.keyboard.press("Tab");
    const hidden = await page.evaluate((pillBox) => {
      const active = document.activeElement;
      if (!active || active === document.body) return null;
      if (active.closest('[data-slot="checklist-pill"]')) return null;
      const rect = active.getBoundingClientRect();
      const overlap =
        Math.max(
          0,
          Math.min(rect.right, pillBox.x + pillBox.width) -
            Math.max(rect.left, pillBox.x),
        ) *
        Math.max(
          0,
          Math.min(rect.bottom, pillBox.y + pillBox.height) -
            Math.max(rect.top, pillBox.y),
        );
      return overlap > 0
        ? (active.textContent?.trim().slice(0, 40) ?? active.tagName)
        : null;
    }, pillBox);
    if (hidden !== null) covered.push(hidden);
  }

  expect(covered).toEqual([]);
});
