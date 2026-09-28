import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;

async function railBeside(page: Page): Promise<boolean> {
  const queue = await page.locator("#queue").boundingBox();
  const progress = await page
    .getByRole("heading", { name: "Progress", level: 2 })
    .boundingBox();
  if (!queue || !progress) throw new Error("layout not rendered");
  return progress.x >= queue.x + queue.width;
}

test("the rail sits beside the queue on a wide page and below it on a narrow one", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/actions");
  await expect(
    page.getByRole("heading", { name: "Progress", level: 2 }),
  ).toBeVisible();
  expect(await railBeside(page)).toBe(true);

  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(() => railBeside(page)).toBe(false);
});

test("collapsing the sidebar gives the rail room beside the queue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/actions");
  await expect(
    page.getByRole("heading", { name: "Progress", level: 2 }),
  ).toBeVisible();
  expect(await railBeside(page)).toBe(false);

  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();

  await expect.poll(() => railBeside(page)).toBe(true);
});

test("the queue and the progress rail each have a section heading", async ({
  page,
}) => {
  await page.goto("/actions");

  await expect(
    page.getByRole("heading", { name: "Queue", level: 2 }),
  ).toBeAttached();
  await expect(
    page.getByRole("heading", { name: "Progress", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText(/confirmed fixed in 30 days/)).toBeVisible();
});

test("the rail shows the open work by app and filters to it", async ({
  page,
}) => {
  await page.goto("/actions");
  const where = page
    .getByRole("heading", { name: "Where the work is" })
    .locator("xpath=..");
  const focus = where.getByRole("link", { name: /Focus Timer · US/ });

  await expect(focus).toContainText("16");
  await focus.click();

  await expect(page).toHaveURL(/app=app-1/);
  await expect(page.locator("[id='action-act-gp-defend']")).toHaveCount(0);
  await expect(page.locator("[id='action-act-uncovered']")).toBeVisible();
});

test("an app's rail shows the open work by market", async ({ page }) => {
  await page.goto("/apps/app-1/actions");

  const where = page
    .getByRole("heading", { name: "Where the work is" })
    .locator("xpath=..");
  await expect(where.getByRole("link", { name: /Germany/ })).toBeVisible();
  await expect(
    where.getByRole("link", { name: /United States/ }),
  ).toBeVisible();
});

const holdActivity = async (page: Page) => {
  const token = randomUUID();
  await page
    .context()
    .addCookies([
      { name: "e2e_activity_hold", value: token, url: "http://localhost:3000" },
    ]);
  return () =>
    page
      .context()
      .request.post(`${MOCK_API_URL}/__activity-holds/${token}/release`);
};

test("the queue stays put when the tiles stream in", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const release = await holdActivity(page);
  await page.goto("/actions", { waitUntil: "commit" });

  await expect(
    page.locator('[data-slot="stat-tile-skeleton"]').first(),
  ).toBeVisible();
  const before = (await page.locator("#queue").boundingBox())!.y;

  await release();
  await expect(page.locator('[data-slot="stat-tile"]').first()).toBeVisible();
  const after = (await page.locator("#queue").boundingBox())!.y;

  expect(Math.abs(after - before)).toBeLessThanOrEqual(8);
});

for (const [width, rows] of [
  [1440, 1],
  [375, 2],
] as const) {
  test(`the tile skeletons form ${rows} row${rows > 1 ? "s" : ""} at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await holdActivity(page);
    await page.goto("/actions", { waitUntil: "commit" });

    const tiles = page.locator('[data-slot="stat-tile-skeleton"]');
    await expect(tiles).toHaveCount(4);
    const tops = await tiles.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(rows);
  });
}

const LAYOUT_WIDTHS = [375, 768, 1024, 1440] as const;
const THEMES = ["light", "dark"] as const;
const LAYOUT_PAGES = [
  {
    name: "workspace",
    path: "/actions",
    sections: ["Queue", "Progress", "Where the work is"],
  },
  {
    name: "app",
    path: "/apps/app-1/actions",
    sections: ["Actions", "Queue", "Progress", "Where the work is"],
  },
] as const;

const headingOutline = (page: Page) =>
  page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
    ).map((heading) => ({
      level: Number(heading.tagName.slice(1)),
      text: heading.textContent?.trim() ?? "",
    })),
  );

const undersizedTargets = (page: Page, minHeight: number, selector: string) =>
  page.locator(selector).evaluateAll(
    (nodes, min) =>
      nodes
        .filter((node) => {
          const box = node.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        })
        .filter((node) => {
          const stretched =
            getComputedStyle(node, "::after").position === "absolute";
          const target = stretched
            ? ((node as HTMLElement).offsetParent ?? node)
            : (node.closest("label") ?? node);
          const box = target.getBoundingClientRect();
          return box.width < 24 || box.height < min;
        })
        .map(
          (node) =>
            `${node.tagName} "${(node.getAttribute("aria-label") ?? node.textContent ?? "").trim().slice(0, 40)}"`,
        ),
    minHeight,
  );

const rowTops = (page: Page) =>
  page
    .locator("#queue [id^='action-act-']")
    .evaluateAll((nodes) =>
      nodes.slice(0, 2).map((node) => node.getBoundingClientRect().top),
    );

const tileRows = async (page: Page): Promise<number> => {
  const tiles = page.locator('[data-slot="stat-tile"]');
  await expect(tiles).toHaveCount(4);
  const tops = await tiles.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
  );
  return new Set(tops).size;
};

for (const theme of THEMES) {
  for (const width of LAYOUT_WIDTHS) {
    for (const layout of LAYOUT_PAGES) {
      test(`the ${layout.name} action center holds its layout at ${width} px in ${theme}`, async ({
        page,
      }) => {
        await page.addInitScript(
          (value) => window.localStorage.setItem("theme", value),
          theme,
        );
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: 812 });
        await page.goto(layout.path);
        await expect(
          page.locator('[data-slot="stat-tile"]').first(),
        ).toBeVisible();
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        await expect(
          page.getByRole("heading", { level: 1 }).first(),
        ).toBeVisible();

        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);

        const outline = await headingOutline(page);
        expect(outline.filter((heading) => heading.level === 1)).toHaveLength(
          1,
        );
        expect(
          outline
            .filter((heading) => heading.level === 2)
            .map((heading) => heading.text),
        ).toEqual(layout.sections);
        outline.reduce((previous, heading) => {
          expect(heading.level).toBeLessThanOrEqual(previous + 1);
          return heading.level;
        }, 0);

        expect(
          await undersizedTargets(
            page,
            24,
            "main button:visible, main a:visible",
          ),
        ).toEqual([]);

        const narrowest = await page
          .locator("#queue [id^='action-act-'] a")
          .evaluateAll((nodes) =>
            Math.min(
              ...nodes.map((node) => node.getBoundingClientRect().width),
            ),
          );
        expect(narrowest).toBeGreaterThanOrEqual(160);

        if (width === 375) {
          expect(
            await undersizedTargets(
              page,
              44,
              "#queue [id^='action-act-'] button:visible",
            ),
          ).toEqual([]);
          expect(await tileRows(page)).toBe(2);
          await page
            .locator("#queue")
            .evaluate((node) => node.scrollIntoView({ block: "start" }));
          const tops = await rowTops(page);
          expect(tops).toHaveLength(2);
          for (const top of tops) expect(top).toBeLessThan(812);
        }

        if (width === 1440) {
          expect(await tileRows(page)).toBe(1);
          expect(await railBeside(page)).toBe(true);
        }
      });
    }

    if (width === 375 || width === 1440) {
      test(`the action sheet fits a ${width} px viewport in ${theme}`, async ({
        page,
      }) => {
        await page.addInitScript(
          (value) => window.localStorage.setItem("theme", value),
          theme,
        );
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: 812 });
        await page.goto("/actions?action=act-uncovered");

        const dialog = page.getByRole("dialog");
        await expect(
          dialog.getByRole("heading", { name: "Trend" }),
        ).toBeVisible();
        const box = async () => (await dialog.boundingBox())!;
        await expect
          .poll(async () => {
            const { x, width: dialogWidth } = await box();
            return x + dialogWidth;
          })
          .toBeLessThanOrEqual(width + 1);
        expect((await box()).x).toBeGreaterThanOrEqual(0);
        expect((await box()).height).toBeLessThanOrEqual(812 + 1);

        const scrolls = await dialog.evaluate((node) =>
          [node, ...Array.from(node.querySelectorAll<HTMLElement>("*"))].some(
            (child) =>
              ["auto", "scroll"].includes(getComputedStyle(child).overflowY) &&
              child.scrollHeight > child.clientHeight,
          ),
        );
        expect(scrolls).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBe(true);
      });
    }
  }
}
