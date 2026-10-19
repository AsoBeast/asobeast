import type { Locator } from "@playwright/test";
import {
  ARABIC_DEVELOPER_REPLY,
  ARABIC_REVIEW_AUTHOR,
  ARABIC_REVIEW_TEXT,
  ARABIC_REVIEW_TITLE,
  HEBREW_REVIEW_TEXT,
  MIXED_REVIEW_TEXT,
} from "./fixtures.mts";
import { seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const readsRightToLeft = (locator: Locator) =>
  locator.evaluate((element) => element.matches(":dir(rtl)"));

const gapsAroundText = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return { left: text.left - box.left, right: box.right - text.right };
  });

test.beforeEach(async ({ context, page }) => {
  await seedCookies(context, { e2e_reviews: "rtl" });
  await page.goto("/apps/app-1/reviews");
  await expect(page.getByRole("article")).toHaveCount(4);
});

test("arabic review title, text, reply and author read right to left", async ({
  page,
}) => {
  const card = page
    .getByRole("article")
    .filter({ hasText: ARABIC_REVIEW_TITLE });
  const title = card.getByText(ARABIC_REVIEW_TITLE, { exact: true });
  const text = card.getByText(ARABIC_REVIEW_TEXT, { exact: true });
  const reply = card.getByText(ARABIC_DEVELOPER_REPLY, { exact: true });
  const author = card.locator("bdi");

  for (const element of [title, text, reply]) {
    await expect(element).toHaveAttribute("dir", "auto");
    expect(await readsRightToLeft(element)).toBe(true);
  }
  await expect(author).toHaveText(ARABIC_REVIEW_AUTHOR);
  expect(await readsRightToLeft(author)).toBe(true);
});

test("a short hebrew review sits at the right edge of the card", async ({
  page,
}) => {
  const text = page
    .getByRole("article")
    .getByText(HEBREW_REVIEW_TEXT, { exact: true });

  const { left, right } = await gapsAroundText(text);

  expect(right).toBeLessThan(left);
});

test("english and mixed reviews that start with a latin word stay left to right", async ({
  page,
}) => {
  for (const content of ["Works well.", MIXED_REVIEW_TEXT]) {
    const text = page.getByRole("article").getByText(content, { exact: true });
    await expect(text).toHaveAttribute("dir", "auto");
    expect(await readsRightToLeft(text)).toBe(false);
  }
  const { left, right } = await gapsAroundText(
    page.getByRole("article").getByText("Works well.", { exact: true }),
  );
  expect(left).toBeLessThan(right);
});

test("the reply field follows the direction of what is typed", async ({
  page,
}) => {
  const card = page
    .getByRole("article")
    .filter({ hasText: ARABIC_REVIEW_TITLE });
  await card
    .getByRole("button", { name: /^Reply to the 1 star review/ })
    .click();
  const field = page.getByRole("textbox", { name: "Reply text" });

  await expect(field).toHaveAttribute("dir", "auto");
  expect(await readsRightToLeft(field)).toBe(false);
  await field.fill("شكرا لك");
  expect(await readsRightToLeft(field)).toBe(true);
  await field.fill("Thank you");
  expect(await readsRightToLeft(field)).toBe(false);
});
