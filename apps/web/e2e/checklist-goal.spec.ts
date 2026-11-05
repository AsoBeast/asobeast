import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Page } from "@playwright/test";
import { THEMES } from "./contrast-check.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { seedSetup, startedSetup } from "./setup-session.mts";
import { seedChecklist } from "./workspace-checklist.mts";

const SETUP_PATH = "/apps/app-1/setup";
const QUESTION = "What would you like to get done?";

const goals = (page: Page) => page.getByRole("group", { name: QUESTION });
const goal = (page: Page, label: string) =>
  goals(page).getByRole("button", { name: new RegExp(`^${label}`) });

const goalPatches = (page: Page): unknown[] => {
  const sent: unknown[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith("/workspace/checklist")
    ) {
      sent.push(JSON.parse(request.postData() ?? "null"));
    }
  });
  return sent;
};

async function openSetup(page: Page, context: BrowserContext) {
  await startedSetup(context, "app-1");
  await seedChecklist(context, "partial");
  await page.goto(SETUP_PATH);
  await hydrated(goal(page, "Improve my rankings"));
}

async function secondStep(page: Page): Promise<string> {
  await page
    .getByRole("button", { name: /done in the setup checklist$/ })
    .click();
  const second = page
    .getByRole("list", { name: "Checklist steps" })
    .locator(":scope > li")
    .nth(1);
  const text = (await second.textContent()) ?? "";
  await page.keyboard.press("Escape");
  return text;
}

test("the setup page opens with the question and nothing chosen", async ({
  page,
  context,
}) => {
  await openSetup(page, context);

  await expect(page.getByRole("heading", { name: QUESTION })).toBeVisible();
  const buttons = goals(page).getByRole("button");
  await expect(buttons).toHaveCount(3);
  for (const label of [
    "Improve my rankings",
    "Research an idea",
    "Use AsoBeast from my AI",
  ]) {
    await expect(goal(page, label)).toHaveAttribute("aria-pressed", "false");
  }
});

test("choosing a goal saves it and reorders the checklist", async ({
  page,
  context,
}) => {
  const sent = goalPatches(page);
  await openSetup(page, context);

  await goal(page, "Improve my rankings").click();

  await expect(goal(page, "Improve my rankings")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Goal set to" }),
  ).toHaveText("Goal set to Improve my rankings");
  expect(sent).toEqual([{ goal: "improve_rankings" }]);
  expect(await secondStep(page)).toContain("Fill your keyword field");
});

test("changing the goal moves the pressed state and the order", async ({
  page,
  context,
}) => {
  await openSetup(page, context);

  await goal(page, "Improve my rankings").click();
  await expect(goal(page, "Improve my rankings")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await goal(page, "Use AsoBeast from my AI").click();

  await expect(goal(page, "Use AsoBeast from my AI")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(goal(page, "Improve my rankings")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(goal(page, "Use AsoBeast from my AI")).toBeFocused();
  expect(await secondStep(page)).toContain("Connect your AI client");
});

for (const key of ["Enter", "Space"]) {
  test(`${key} chooses a goal from the keyboard`, async ({ page, context }) => {
    await openSetup(page, context);
    const research = goal(page, "Research an idea");

    await research.focus();
    await page.keyboard.press(key);

    await expect(research).toHaveAttribute("aria-pressed", "true");
    await expect(research).toBeFocused();
  });
}

test("arrow keys never choose a goal", async ({ page, context }) => {
  const sent = goalPatches(page);
  await openSetup(page, context);

  await goal(page, "Research an idea").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");

  await expect(goals(page).locator('[aria-pressed="true"]')).toHaveCount(0);
  expect(sent).toEqual([]);
});

test("a failed save rolls the goal back", async ({ page, context }) => {
  await context.addCookies([
    { name: "e2e_checklist_fail", value: "1", domain: "localhost", path: "/" },
  ]);
  await openSetup(page, context);

  await goal(page, "Improve my rankings").click();

  await expect(page.getByText("Could not save your goal")).toBeVisible();
  await expect(goal(page, "Improve my rankings")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a failed goal read offers a retry on the setup page", async ({
  page,
  context,
}) => {
  await startedSetup(context, "app-1");
  await seedChecklist(context, "partial");
  await context.addCookies([
    {
      name: "e2e_checklist_read_fail",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto(SETUP_PATH);

  await expect(
    page.getByRole("alert").filter({ hasText: "Could not load your goal." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("heading", { name: QUESTION })).toHaveCount(0);
});

for (const status of ["completed", "dismissed"] as const) {
  test(`the question stays when the setup is ${status}`, async ({
    page,
    context,
  }) => {
    await seedSetup(context, "app-1", { status });
    await seedChecklist(context, "partial");
    await page.goto(SETUP_PATH);

    await expect(page.getByRole("heading", { name: QUESTION })).toBeVisible();
    await expect(goals(page).getByRole("button")).toHaveCount(3);
  });
}

test("settings shares the goal with the setup page and the popover", async ({
  page,
  context,
}) => {
  await startedSetup(context, "app-1");
  await seedChecklist(context, "partial");
  await page.goto("/settings");
  const section = page.locator("section#getting-started");
  await expect(
    section.getByRole("heading", { name: QUESTION, level: 3 }),
  ).toBeVisible();

  await (await hydrated(goal(page, "Improve my rankings"))).click();
  await expect(goal(page, "Improve my rankings")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.goto(SETUP_PATH);
  await expect(goal(page, "Improve my rankings")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await (
    await hydrated(
      page.getByRole("button", { name: /done in the setup checklist$/ }),
    )
  ).click();
  const popover = page.getByRole("dialog", { name: "Setup checklist" });
  await expect(popover).toContainText("Goal: Improve my rankings");
  await expect(popover.getByRole("link", { name: "Change" })).toHaveAttribute(
    "href",
    "/settings#getting-started",
  );
});

for (const width of [320, 375]) {
  test(`the goals stack at ${width} px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 });
    await openSetup(page, context);

    const first = await goal(page, "Improve my rankings").boundingBox();
    const second = await goal(page, "Research an idea").boundingBox();
    expect(first && second && second.y > first.y).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

for (const theme of THEMES) {
  test(`the setup page with a chosen goal passes axe in the ${theme} theme`, async ({
    page,
    context,
  }) => {
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await openSetup(page, context);
    await goal(page, "Research an idea").click();
    await expect(goal(page, "Research an idea")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const { violations } = await new AxeBuilder({ page })
      .withRules([
        "color-contrast",
        "aria-valid-attr-value",
        "aria-allowed-attr",
      ])
      .analyze();
    expect(violations.flatMap(({ nodes }) => nodes)).toEqual([]);
  });
}
