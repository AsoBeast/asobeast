import { expect, test } from "./session.mts";
import { SIGNED_IN_ROUTES } from "./routes.mts";

for (const [name, path] of SIGNED_IN_ROUTES) {
  test(`${name} exposes one main landmark and one level one heading`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test(`${name} descends heading levels without skipping`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const levels = await page.evaluate(() =>
      Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map(
        (heading) => Number(heading.tagName.slice(1)),
      ),
    );
    expect(levels.length).toBeGreaterThan(0);

    const skipped = levels.filter((level, index) => {
      const previous = levels[index - 1];
      return previous !== undefined && level - previous > 1;
    });
    expect(skipped, `heading outline was ${levels.join(", ")}`).toEqual([]);
  });
}

test("a skip link is the first tabbable control and targets the main region", async ({
  page,
}) => {
  await page.goto("/");

  await page.keyboard.press("Tab");
  const skipLink = page.locator(":focus");

  await expect(skipLink).toHaveRole("link");

  const box = await skipLink.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(40);
  expect(box?.height ?? 0).toBeGreaterThan(16);

  const href = await skipLink.getAttribute("href");
  if (href === null) throw new Error("the skip link has no href");
  expect(href).toMatch(/^#/);

  const target = page.locator(href);
  await expect(target).toHaveRole("main");

  await page.keyboard.press("Enter");
  await expect(target).toBeFocused();
});

test("the shell exposes one banner above one named sidebar navigation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toHaveCount(1);

  const sidebar = page.getByRole("navigation", { name: "Main" });
  await expect(sidebar).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Documentation" }),
  ).toBeVisible();
});

test("focus order runs sidebar, then header, then main", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const order = await page.evaluate(() => {
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex='0']",
      ),
    ).filter((node) => node.offsetParent !== null);
    const region = (node: HTMLElement) => {
      if (node.closest("nav[aria-label='Main']")) return "sidebar";
      if (node.closest("header")) return "header";
      if (node.closest("main")) return "main";
      return "other";
    };
    return focusable.map(region).filter((name) => name !== "other");
  });

  const firstHeader = order.indexOf("header");
  const firstMain = order.indexOf("main");
  expect(order.lastIndexOf("sidebar")).toBeLessThan(firstHeader);
  expect(order.lastIndexOf("header")).toBeLessThan(firstMain);
});

test("collapsing the sidebar keeps its controls focusable", async ({
  page,
}) => {
  await page.goto("/");

  const documentation = page.getByRole("link", { name: "Documentation" });
  await documentation.focus();
  await page.keyboard.press("ControlOrMeta+b");

  await expect(page.locator("[data-slot=sidebar]")).toHaveAttribute(
    "data-state",
    "collapsed",
  );
  await expect(documentation).toBeVisible();
  await expect(documentation).toBeFocused();
});

test("app section navigation is a named nav landmark", async ({ page }) => {
  await page.goto("/apps/app-1");

  const nav = page.getByRole("navigation", { name: "App sections" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Keywords" })).toHaveAttribute(
    "href",
    "/apps/app-1/keywords",
  );
});
