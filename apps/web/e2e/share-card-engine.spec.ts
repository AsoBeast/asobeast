import {
  isPng,
  pngSize,
  recordClipboardPng,
  writtenPng,
} from "./chart-image.mts";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";

test("copies the card in WebKit", async ({ page }) => {
  await recordClipboardPng(page);
  await page.goto("/apps/app-1/rankings");
  await (
    await hydrated(
      page.getByRole("button", { name: "Share the rankings chart" }),
    )
  ).click();
  const dialog = page.getByRole("dialog", { name: "Share the rankings chart" });
  await expect(dialog.getByRole("img")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );

  await dialog.getByRole("button", { name: "Copy image" }).click();
  await expect(page.getByText("Chart copied")).toBeVisible();

  const png = await writtenPng(page);
  expect(isPng(png)).toBe(true);
  expect(await pngSize(page, png)).toEqual({ width: 1200, height: 675 });
});
