import { randomUUID } from "node:crypto";
import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { MOCK_API_URL } from "./localizations.mts";
import { collectPageErrors } from "./page-errors.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const PAGE = "/apps/app-1/competitors";
const TRACKED = "Track the apps you rank against";
const DISCOVERY = "Apps you don’t track yet";
const MATRIX = "Your position against every competitor";
const COOKIE = "asobeast_collapsed";
const LOG_COOKIE = "e2e_discovery_log";
const SECTIONS = [TRACKED, DISCOVERY, MATRIX];

const trigger = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const discoveryTable = (page: Page) =>
  page.getByRole("table", { name: /appearing in your keyword search results/ });
const matrixTable = (page: Page) =>
  page.getByRole("table", { name: /compared with each tracked competitor/ });
const addForm = (page: Page) =>
  page.getByRole("textbox", { name: "Competitor name or App Store URL" });

const collapsed = (...ids: string[]) => ({
  [COOKIE]: encodeURIComponent(ids.join(",")),
});

async function storedCollapsed(
  context: BrowserContext,
): Promise<string | null> {
  const cookie = (await context.cookies()).find(({ name }) => name === COOKIE);
  return cookie ? decodeURIComponent(cookie.value) : null;
}

async function discoveryReads(
  request: APIRequestContext,
  token: string,
): Promise<number> {
  const response = await request.get(
    `${MOCK_API_URL}/__log/discovery-requests/${token}`,
    { failOnStatusCode: true },
  );
  return ((await response.json()) as { count: number }).count;
}

async function logDiscovery(context: BrowserContext): Promise<string> {
  const token = randomUUID();
  await seedCookies(context, { [LOG_COOKIE]: token });
  return token;
}

async function open(page: Page, path = PAGE): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test("every section is open on a first visit", async ({ page, context }) => {
  await open(page);

  for (const name of SECTIONS) {
    const button = trigger(page, name);
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toHaveAttribute("aria-controls", /.+/);
    await expect(page.getByRole("region", { name })).toHaveCount(1);
  }
  await expect(addForm(page)).toBeVisible();
  await expect(
    page.getByText("1 tracked competitor", { exact: true }),
  ).toBeVisible();
  await expect(discoveryTable(page)).toBeVisible();
  await expect(matrixTable(page)).toBeVisible();
  expect(await storedCollapsed(context)).toBeNull();
});

test("a section collapses behind its title and stays collapsed on reload", async ({
  page,
  context,
  request,
}) => {
  const token = await logDiscovery(context);
  await open(page);

  const discovery = await hydrated(trigger(page, DISCOVERY));
  await discovery.click();

  await expect(discovery).toHaveAttribute("aria-expanded", "false");
  await expect(discovery).not.toHaveAttribute("aria-controls", /.*/);
  await expect(discoveryTable(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: DISCOVERY })).toBeVisible();
  await expect(page.getByRole("tab", { name: "30d" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: DISCOVERY }).getByText("App Store"),
  ).toBeVisible();
  expect(await storedCollapsed(context)).toBe("competitors.discovery");

  const before = await discoveryReads(request, token);
  await page.reload();
  await page.waitForLoadState("networkidle");

  await expect(trigger(page, DISCOVERY)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(discoveryTable(page)).toHaveCount(0);
  await expect(trigger(page, TRACKED)).toHaveAttribute("aria-expanded", "true");
  await expect(trigger(page, MATRIX)).toHaveAttribute("aria-expanded", "true");
  expect(await discoveryReads(request, token)).toBe(before);
});

test("a collapsed section fetches nothing on its first render and loads when it opens", async ({
  page,
  context,
  request,
}) => {
  const token = await logDiscovery(context);
  await seedCookies(context, collapsed("competitors.discovery"));
  await open(page);

  const discovery = trigger(page, DISCOVERY);
  await expect(discovery).toHaveAttribute("aria-expanded", "false");
  await expect(discoveryTable(page)).toHaveCount(0);
  expect(await discoveryReads(request, token)).toBe(0);

  await (await hydrated(discovery)).click();

  await expect(discoveryTable(page)).toBeVisible();
  await expect.poll(() => discoveryReads(request, token)).toBe(1);
});

test("a collapsed section can be expanded with the keyboard and keeps focus", async ({
  page,
  context,
}) => {
  await seedCookies(context, collapsed("competitors.discovery"));
  await open(page);

  const button = await hydrated(trigger(page, DISCOVERY));
  await button.focus();
  await page.keyboard.press("Enter");

  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(discoveryTable(page)).toBeVisible();
  await expect(button).toBeFocused();

  await page.keyboard.press("Space");

  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(discoveryTable(page)).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("an unknown section id in the cookie is ignored and dropped on the next toggle", async ({
  page,
  context,
}) => {
  await seedCookies(
    context,
    collapsed("competitors.bogus", "competitors.matrix"),
  );
  await open(page);

  await expect(trigger(page, MATRIX)).toHaveAttribute("aria-expanded", "false");
  await expect(trigger(page, DISCOVERY)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(trigger(page, TRACKED)).toHaveAttribute("aria-expanded", "true");

  await (await hydrated(trigger(page, DISCOVERY))).click();

  await expect(trigger(page, DISCOVERY)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(await storedCollapsed(context)).toBe(
    "competitors.discovery,competitors.matrix",
  );
});

for (const [label, value] of [
  ["an oversized value", "x".repeat(2000)],
  [
    "a value over the limit made of known ids",
    encodeURIComponent(Array(80).fill("competitors.matrix").join(",")),
  ],
  ["a malformed escape", "competitors.matrix%E0%A4%A"],
  ["inherited object names", encodeURIComponent("__proto__,constructor")],
] as const) {
  test(`a tampered cookie leaves every section open (${label})`, async ({
    page,
    context,
  }) => {
    await seedCookies(context, { [COOKIE]: value });
    const errors = collectPageErrors(page);
    await open(page);

    for (const name of SECTIONS) {
      await expect(trigger(page, name)).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    }
    expect(errors).toEqual([]);
  });
}

test("the only gaps switch works while the matrix is collapsed", async ({
  page,
  context,
}) => {
  await seedCookies(context, collapsed("competitors.matrix"));
  await open(page);

  const gaps = await hydrated(page.getByRole("switch", { name: "only gaps" }));
  await gaps.click();

  await expect(page).toHaveURL(/onlyGaps=true/);
  await expect(trigger(page, MATRIX)).toHaveAttribute("aria-expanded", "false");
  await expect(matrixTable(page)).toHaveCount(0);

  await trigger(page, MATRIX).click();

  await expect(matrixTable(page).getByRole("row")).toHaveCount(2);
  await expect(matrixTable(page)).toContainText("productivity app");
});

test("a deep link with only gaps and a collapsed matrix shows the switch on and the rows when opened", async ({
  page,
  context,
}) => {
  await seedCookies(context, collapsed("competitors.matrix"));
  await open(page, `${PAGE}?onlyGaps=true`);

  await expect(page.getByRole("switch", { name: "only gaps" })).toBeChecked();
  await expect(matrixTable(page)).toHaveCount(0);

  await (await hydrated(trigger(page, MATRIX))).click();

  await expect(matrixTable(page).getByRole("row")).toHaveCount(2);
});

test("collapsing the tracked section hides the form and the list together", async ({
  page,
}) => {
  await open(page);
  const exportCompetitors = page.getByRole("button", {
    name: "Export CSV of competitors",
  });

  await (await hydrated(trigger(page, TRACKED))).click();

  await expect(addForm(page)).toHaveCount(0);
  await expect(
    page.getByText("1 tracked competitor", { exact: true }),
  ).toHaveCount(0);
  await expect(exportCompetitors).toHaveCount(0);
  await expect(trigger(page, TRACKED)).toBeVisible();

  await trigger(page, TRACKED).click();

  await expect(addForm(page)).toBeVisible();
  await expect(
    page.getByText("1 tracked competitor", { exact: true }),
  ).toBeVisible();
  await expect(exportCompetitors).toHaveCount(1);
});

test("with no competitors the first section holds the form alone", async ({
  page,
}) => {
  await open(page, "/apps/app-2/competitors");

  await expect(addForm(page)).toBeVisible();
  await expect(page.getByText(/tracked competitor/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export CSV of competitors" }),
  ).toHaveCount(0);
  for (const name of SECTIONS) {
    await expect(trigger(page, name)).toHaveCount(1);
  }
});

test("a collapsed section is still collapsed when you come back to the page", async ({
  page,
}) => {
  await open(page);
  await (await hydrated(trigger(page, DISCOVERY))).click();
  await expect(discoveryTable(page)).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "App sections" })
    .getByRole("link", { name: "Keywords" })
    .click();
  await expect(page).toHaveURL(/keywords/);
  await page.goBack();

  await expect(trigger(page, DISCOVERY)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(discoveryTable(page)).toHaveCount(0);
});

test("it collapses and expands with the animation off under reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const matrix = await hydrated(trigger(page, MATRIX));

  await matrix.click();
  await expect(matrixTable(page)).toHaveCount(0);
  const duration = await matrix
    .locator("svg")
    .evaluate((node) => getComputedStyle(node).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.001);

  await matrix.click();
  await expect(matrixTable(page)).toBeVisible();
});

test("a collapsed section stays collapsed in print", async ({
  page,
  context,
}) => {
  await seedCookies(context, collapsed("competitors.matrix"));
  await open(page);
  await page.emulateMedia({ media: "print" });

  await expect(matrixTable(page)).toHaveCount(0);
  await expect(trigger(page, MATRIX)).toHaveAttribute("aria-expanded", "false");
});

test("two toggles in a row leave one cookie that matches the screen", async ({
  page,
  context,
}) => {
  await open(page);
  await (await hydrated(trigger(page, MATRIX))).click();
  await trigger(page, DISCOVERY).click();

  await expect
    .poll(() => storedCollapsed(context))
    .toBe("competitors.discovery,competitors.matrix");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(trigger(page, MATRIX)).toHaveAttribute("aria-expanded", "false");
  await expect(trigger(page, DISCOVERY)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(trigger(page, TRACKED)).toHaveAttribute("aria-expanded", "true");

  await (await hydrated(trigger(page, MATRIX))).click();
  await expect
    .poll(() => storedCollapsed(context))
    .toBe("competitors.discovery");

  await trigger(page, DISCOVERY).click();
  await expect.poll(() => storedCollapsed(context)).toBeNull();
});
