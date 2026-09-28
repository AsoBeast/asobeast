import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

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
