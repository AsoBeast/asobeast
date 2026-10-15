import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_GP_DETAIL, APP_REPLIES_ID } from "./fixtures.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const REPLIES_PAGE = `/apps/${APP_REPLIES_ID}/reviews`;
const GP_PAGE = `/apps/${APP_GP_DETAIL.id}/reviews`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  for (const id of [APP_REPLIES_ID, APP_GP_DETAIL.id]) {
    await request.post(`${MOCK_API_URL}/__reset/review-replies/${id}`, {
      failOnStatusCode: true,
    });
  }
});

const articleOf = (page: Page, text: string) =>
  page.getByRole("article").filter({ hasText: text });

const composer = (page: Page) =>
  page.getByRole("region", { name: "Reply to review" });

const strip = (page: Page) =>
  page.getByRole("region", { name: "Reply status" });

test("writing a reply by hand saves it and the list shows a draft", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(REPLIES_PAGE);
  const article = articleOf(page, "Please add dark mode.");

  await article.getByRole("button", { name: "Reply", exact: true }).click();

  await expect(page).toHaveURL(/reply=rep-3/);
  await expect(composer(page)).toBeVisible();
  await expect(composer(page).getByRole("textbox")).toHaveValue("");

  await composer(page)
    .getByRole("textbox", { name: "Reply text" })
    .fill("Dark mode is on our list, thanks for asking.");
  await expect(composer(page).getByText("44 / 2000")).toBeVisible();

  const [request] = await Promise.all([
    page.waitForRequest(
      (candidate) =>
        candidate.method() === "PATCH" &&
        candidate.url().endsWith(`/apps/${APP_REPLIES_ID}/reviews/rep-3/reply`),
    ),
    composer(page).getByRole("button", { name: "Copy" }).click(),
  ]);

  expect(request.postDataJSON()).toEqual({
    text: "Dark mode is on our list, thanks for asking.",
  });
  await expect(page.getByText("Reply copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Dark mode is on our list, thanks for asking.",
  );
  await expect(article.getByText("Draft saved")).toBeVisible();
  await expect(
    strip(page).getByRole("button", { name: /Draft saved/ }),
  ).toContainText("2");
});

test("the composer counts against the google play limit and refuses more", async ({
  page,
}) => {
  await page.goto(`${GP_PAGE}?reply=gp-rev-2`);

  await composer(page)
    .getByRole("textbox", { name: "Reply text" })
    .fill("a".repeat(351));

  await expect(
    composer(page).getByText(
      "351 / 350 · Google Play allows at most 350 characters",
    ),
  ).toBeVisible();
  await expect(
    composer(page).getByRole("button", { name: "Copy" }),
  ).toBeDisabled();
  await expect(
    composer(page).getByRole("button", { name: "Mark as replied" }),
  ).toBeDisabled();
});

test("marking a review as replied and undoing it", async ({ page }) => {
  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);
  const article = articleOf(page, "Crashes often");

  await composer(page).getByRole("button", { name: "Mark as replied" }).click();

  await expect(article.getByText("Marked replied")).toBeVisible();
  await expect(
    strip(page).getByRole("button", { name: /Replied/ }),
  ).toContainText("2");
  await expect(
    strip(page).getByRole("button", { name: /Draft saved/ }),
  ).toContainText("0");

  await composer(page).getByRole("button", { name: "Undo" }).click();

  await expect(article.getByText("Draft saved")).toBeVisible();
});

test("discarding a reply asks first and clears the draft", async ({ page }) => {
  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);
  const article = articleOf(page, "Crashes often");

  await composer(page).getByRole("button", { name: "Discard" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Discard this reply?");

  const [request] = await Promise.all([
    page.waitForRequest((candidate) => candidate.method() === "DELETE"),
    dialog.getByRole("button", { name: "Discard" }).click(),
  ]);

  expect(request.url()).toContain(
    `/apps/${APP_REPLIES_ID}/reviews/rep-2/reply`,
  );
  await expect(article.getByText("Needs reply")).toBeVisible();
  await expect(composer(page)).toBeVisible();
  await expect(composer(page).getByRole("textbox")).toHaveValue("");
});

test("the console link names the store and opens in a new tab", async ({
  page,
}) => {
  await page.goto(`${REPLIES_PAGE}?reply=rep-3`);
  const appStore = composer(page).getByRole("link", {
    name: "Open App Store Connect",
  });

  await expect(appStore).toHaveAttribute(
    "href",
    /\/apps\/123456789\/distribution\/activity\/ios\/ratingsResponses$/,
  );
  await expect(appStore).toHaveAttribute("target", "_blank");
  await expect(appStore).toHaveAttribute("rel", "noreferrer");

  await page.goto(`${GP_PAGE}?reply=gp-rev-2`);

  await expect(
    composer(page).getByRole("link", { name: "Open Play Console" }),
  ).toBeVisible();
});

test("a reload reopens the composer with the saved text", async ({ page }) => {
  await page.goto(`${REPLIES_PAGE}?reply=rep-3`);
  const textbox = composer(page).getByRole("textbox", { name: "Reply text" });

  await textbox.fill("Dark mode ships next month.");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" && response.status() === 200,
    ),
    textbox.blur(),
  ]);
  await page.reload();

  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toHaveValue("Dark mode ships next month.");
});

test("the existing play reply is shown read only above the composer", async ({
  page,
}) => {
  await page.goto(`${GP_PAGE}?reply=gp-rev-1`);

  await expect(composer(page).getByText(/^Developer reply/)).toBeVisible();
  await expect(
    composer(page).getByText(
      "Google Play already shows a reply; a new text here replaces it when you post it in the console.",
    ),
  ).toBeVisible();
  await expect(composer(page).getByRole("textbox")).toHaveValue("");
});
