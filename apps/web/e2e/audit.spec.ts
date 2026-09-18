import { expect, test } from "./session.mts";
import { seedCookies } from "./routes.mts";

test("shows one score with its grade, measured share and potential", async ({
  page,
}) => {
  await page.goto("/apps/app-1/audit");

  const hero = page.getByRole("region", { name: "ASO score" });
  await expect(
    hero.getByRole("img", {
      name: "ASO score 72 out of 100, grade B, Good, 82% measured",
    }),
  ).toBeVisible();
  await expect(hero.getByText("Reach 86 by finishing the plan")).toBeVisible();
  await expect(hero.getByText("82% of the rubric measured")).toBeVisible();
});

test("never labels the history snapshot as the latest score", async ({
  page,
}) => {
  await page.goto("/apps/app-1/audit");

  await expect(page.getByText("Latest ASO score")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Score history" }),
  ).toBeVisible();
});

test("shows the score without scrolling on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/apps/app-1/audit");

  await expect(
    page.getByRole("img", { name: /^ASO score 72/ }),
  ).toBeInViewport();
});

test("labels a low confidence grade provisional", async ({ page, context }) => {
  await seedCookies(context, { e2e_audit: "provisional" });
  await page.goto("/apps/app-1/audit");

  await expect(page.getByText("Provisional · 55% measured")).toBeVisible();
});

test("names the date of the history snapshot it shows", async ({ page }) => {
  await page.goto("/apps/app-gp/audit");

  await expect(page.getByText(/Last daily snapshot · /)).toBeVisible();
});

test("lists the top fixes and the plan with lifts and working tabs", async ({
  page,
}) => {
  await page.goto("/apps/app-1/audit");

  const top = page.getByRole("region", { name: "Top fixes" });
  await expect(top.getByRole("listitem")).toHaveCount(3);
  await expect(top.getByText(/^\+\d+(\.\d)? points$/).first()).toBeVisible();

  const quickWins = page.getByRole("tab", { name: /^Quick wins/ });
  await quickWins.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /^High impact/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("says a bucket may grow while checks are unanswered, and never praises an empty one", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_audit: "provisional" });
  await page.goto("/apps/app-1/audit");

  await page.getByRole("tab", { name: /^High impact/ }).click();
  await expect(
    page.getByText(/checks are not scored, so this list may grow/),
  ).toBeVisible();
  await expect(page.getByText(/great work/i)).toHaveCount(0);
});

test("opens the place to make the change", async ({ page }) => {
  await page.goto("/apps/app-1/audit");

  await page
    .getByRole("tabpanel")
    .getByRole("link", { name: "Open the metadata workbench" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/apps\/app-1\/metadata$/);
});

for (const width of [375, 1280]) {
  test(`aligns factor meters in a row at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/apps/app-1/audit");

    const lefts = await page
      .getByRole("region", { name: "Search visibility" })
      .locator('[data-slot="meter"]')
      .evaluateAll((nodes) =>
        nodes.map((node) => Math.round(node.getBoundingClientRect().left)),
      );

    expect(new Set(lefts).size).toBeLessThanOrEqual(width < 640 ? 1 : 3);
  });
}

test("links an unanswered check to what would answer it", async ({ page }) => {
  await page.goto("/apps/app-1/audit");

  const field = page.getByRole("article", { name: "Keyword field" });
  await expect(
    field.getByRole("link", {
      name: "Paste your keyword field from App Store Connect",
    }),
  ).toHaveAttribute("href", "/apps/app-1/keywords");
});

test("speaks plainly", async ({ page }) => {
  await page.goto("/apps/app-1/audit");

  await expect(page.locator("main")).not.toContainText(
    /weight \d+|heuristic|renormalize/,
  );
  await expect(page.locator("main")).not.toContainText(/pending/i);
});

test("shows a Google Play listing only Google Play concepts", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/audit");

  await page
    .getByRole("button", { name: /Show checks/ })
    .first()
    .click();
  await expect(page.locator("main")).not.toContainText(
    /Subtitle|Keyword field|Promotional text/,
  );
  await expect(
    page.getByRole("article", { name: "Short description" }),
  ).toBeVisible();
});

test("says what the audit cannot see", async ({ page }) => {
  await page.goto("/apps/app-1/audit");

  await page.getByText("What this audit cannot see").click();
  await expect(page.getByText("App previews")).toBeVisible();
});

test("explains how to enable the analysis when no key is configured", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_ai_unconfigured: "1" });
  await page.goto("/apps/app-1/audit");

  const panel = page.getByRole("region", { name: "AI creative analysis" });
  await expect(panel.getByText(/Add OPENAI_API_KEY/)).toBeVisible();
  await expect(
    panel.getByRole("link", { name: /AI features guide/ }),
  ).toHaveAttribute("href", "https://docs.asobeast.com/guides/ai-features");
  await expect(panel.getByRole("button")).toHaveCount(0);
});

test("queues an analysis, shows progress, then the new score", async ({
  page,
}) => {
  await page.goto("/apps/app-gp/audit");
  const panel = page.getByRole("region", { name: "AI creative analysis" });

  await panel.getByRole("button", { name: "Analyze creative" }).click();

  await expect(panel.getByRole("status")).toContainText(
    "Analyzing your icon and",
  );
  await expect(page.getByText("Creative analysis finished")).toBeVisible({
    timeout: 10_000,
  });
  await expect(panel.getByText("Up to date")).toBeVisible();
});

test("shows a failed analysis and tries again", async ({ page, context }) => {
  await seedCookies(context, { e2e_ai_fail: "1" });
  await page.goto("/apps/app-gp/audit");
  const panel = page.getByRole("region", { name: "AI creative analysis" });

  await panel.getByRole("button", { name: "Analyze creative" }).click();

  await expect(panel.getByRole("alert")).toContainText(
    "OpenAI rejected the API key. Check OPENAI_API_KEY.",
  );
  const request = page.waitForRequest(
    (req) => req.method() === "POST" && req.url().endsWith("/audit/ai/runs"),
  );
  await panel.getByRole("button", { name: "Try again" }).click();
  await request;
});

test("offers to analyze again when the creative changed", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_ai_stale: "1" });
  await page.goto("/apps/app-1/audit");
  const panel = page.getByRole("region", { name: "AI creative analysis" });

  await expect(panel.getByText("Outdated")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Analyze again" }),
  ).toBeEnabled();
});

test("says an unchanged listing is already analyzed", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_ai_reused: "1" });
  await page.goto("/apps/app-gp/audit");

  await page
    .getByRole("region", { name: "AI creative analysis" })
    .getByRole("button", { name: "Analyze creative" })
    .click();

  await expect(page.getByText("Already up to date")).toBeVisible();
});

test("sends one request for a double click", async ({ page }) => {
  await page.goto("/apps/app-gp/audit");
  const posts: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().endsWith("/audit/ai/runs")) {
      posts.push(req.url());
    }
  });

  await page
    .getByRole("region", { name: "AI creative analysis" })
    .getByRole("button", { name: "Analyze creative" })
    .dblclick();
  await page.waitForLoadState("networkidle");

  expect(posts).toHaveLength(1);
});

test("shows what the analysis read on each screenshot", async ({ page }) => {
  await page.goto("/apps/app-1/audit");
  const strip = page.getByRole("list", { name: "Screenshots" });

  await expect(strip.getByRole("listitem")).toHaveCount(6);
  const first = strip.getByRole("listitem").first();
  await expect(first).toContainText("Guess any place");
  await expect(first).toContainText("Benefit");
  await expect(first.getByText("geo quiz")).toBeVisible();
});

test("labels observations of previous screenshots as outdated", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_ai_stale: "1" });
  await page.goto("/apps/app-1/audit");

  await expect(
    page.getByText("These observations describe your previous screenshots."),
  ).toBeVisible();
});

test("shows a placeholder when a screenshot cannot load", async ({ page }) => {
  await page.route("**/_next/image**", (route) => route.abort());
  await page.goto("/apps/app-1/audit");

  const strip = page.getByRole("list", { name: "Screenshots" });
  await expect(strip.getByText("Image unavailable").first()).toBeVisible();
});

test("compares the listing with its competitors in words and numbers", async ({
  page,
}) => {
  await page.goto("/apps/app-1/audit");
  const table = page.getByRole("table", {
    name: "How your listing compares with 3 competitors",
  });

  await expect(table.getByRole("row", { name: /Ratings/ })).toContainText(
    "Behind",
  );
  await expect(
    table.getByRole("row", { name: /Days since update/ }),
  ).toContainText("Ahead");
});

test("invites adding competitors when there are none", async ({ page }) => {
  await page.goto("/apps/app-2/audit");

  await expect(
    page.getByRole("link", { name: "Add competitors" }),
  ).toHaveAttribute("href", "/apps/app-2/competitors");
});

test("copies the report", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/apps/app-1/audit");

  await page.getByRole("button", { name: "Copy report" }).click();

  await expect(page.getByText("Report copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "# ASO audit:",
  );
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`paints the score ring in the ${colorScheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/apps/app-1/audit");

    const stroke = await page
      .locator('[data-slot="score-ring"] circle')
      .last()
      .evaluate((node) => getComputedStyle(node).stroke);

    expect(stroke).not.toBe("none");
    expect(stroke).not.toContain("rgba(0, 0, 0, 0)");
  });
}

test("keeps the skeleton and the loaded hero the same height", async ({
  page,
  context,
}) => {
  await seedCookies(context, { e2e_audit_slow: "1" });
  await page.goto("/apps/app-1/audit", { waitUntil: "commit" });

  const skeleton = page.locator('[data-slot="score-ring-skeleton"]');
  await expect(skeleton).toBeVisible();
  const before = await skeleton.boundingBox();

  const ring = page.locator('[data-slot="score-ring"]').first();
  await expect(ring).toBeVisible();
  const after = await ring.boundingBox();

  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs(before!.height - after!.height)).toBeLessThanOrEqual(8);
});
