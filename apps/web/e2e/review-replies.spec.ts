import type { BrowserContext, Page } from "@playwright/test";
import type { ApiErrorEnvelope } from "@asobeast/shared";
import { expect, test } from "./session.mts";
import {
  APP_GP_DETAIL,
  APP_REPLIES_ID,
  errorEnvelope,
  REVIEW_REPLY_DRAFT,
} from "./fixtures.mts";
import { fulfillJson } from "./plan-helpers.mts";
import { seedCookies } from "./routes.mts";

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

  await article.getByRole("button", { name: /^Reply to/ }).click();

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

test("a reply at the limit followed by a newline still fits", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`${GP_PAGE}?reply=gp-rev-2`);
  const textbox = composer(page).getByRole("textbox", { name: "Reply text" });

  await textbox.fill(`${"a".repeat(350)}\n`);

  await expect(composer(page).getByText("350 / 350")).toBeVisible();
  await expect(composer(page).getByText(/allows at most/)).toHaveCount(0);
  await expect(textbox).not.toHaveAttribute("aria-invalid", "true");
  await expect(
    composer(page).getByRole("button", { name: "Copy" }),
  ).toBeEnabled();
  await expect(
    composer(page).getByRole("button", { name: "Mark as replied" }),
  ).toBeEnabled();

  const [request] = await Promise.all([
    page.waitForRequest(
      (candidate) =>
        candidate.method() === "PATCH" &&
        candidate.url().endsWith("/reviews/gp-rev-2/reply"),
    ),
    composer(page).getByRole("button", { name: "Copy" }).click(),
  ]);

  expect(request.postDataJSON()).toEqual({ text: "a".repeat(350) });
});

test("whitespace around a reply is not counted but its characters are", async ({
  page,
}) => {
  await page.goto(`${GP_PAGE}?reply=gp-rev-2`);
  const textbox = composer(page).getByRole("textbox", { name: "Reply text" });

  await textbox.fill(`  ${"a".repeat(350)}  `);
  await expect(composer(page).getByText("350 / 350")).toBeVisible();

  await textbox.fill(`${"a".repeat(351)}\n`);
  await expect(
    composer(page).getByText(
      "351 / 350 · Google Play allows at most 350 characters",
    ),
  ).toBeVisible();
  await expect(
    composer(page).getByRole("button", { name: "Copy" }),
  ).toBeDisabled();

  await textbox.fill("  \n ");
  await expect(composer(page).getByText("0 / 350")).toBeVisible();
  await expect(
    composer(page).getByRole("button", { name: "Copy" }),
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

const slowReplies = (page: Page) =>
  page.route("**/api/backend/apps/*/reviews/*/reply", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

test("Mark as replied keeps keyboard focus while the request runs and after", async ({
  page,
}) => {
  await slowReplies(page);
  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);
  const mark = composer(page).getByRole("button", { name: "Mark as replied" });

  await mark.focus();
  await page.keyboard.press("Enter");

  await expect(mark).toBeFocused();
  await expect(mark).toHaveAttribute("aria-disabled", "true");
  const undo = composer(page).getByRole("button", { name: "Undo" });
  await expect(undo).toBeFocused();
  await expect(undo).not.toHaveAttribute("aria-disabled", "true");
});

test("Undo keeps keyboard focus while the request runs and after", async ({
  page,
}) => {
  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);
  await composer(page).getByRole("button", { name: "Mark as replied" }).click();
  const undo = composer(page).getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  await slowReplies(page);

  await undo.focus();
  await page.keyboard.press("Enter");

  await expect(undo).toBeFocused();
  await expect(
    composer(page).getByRole("button", { name: "Mark as replied" }),
  ).toBeFocused();
});

test("a mouse click on Mark as replied keeps focus on the button", async ({
  page,
}) => {
  await slowReplies(page);
  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);

  await composer(page).getByRole("button", { name: "Mark as replied" }).click();

  await expect(
    composer(page).getByRole("button", { name: "Undo" }),
  ).toBeFocused();
});

test("a failed mark leaves focus on the button and enables it again", async ({
  page,
}) => {
  await page.route("**/api/backend/apps/*/reviews/*/reply", (route) =>
    route.fulfill(
      fulfillJson(
        500,
        errorEnvelope(500, "/reply", "Could not save the reply"),
      ),
    ),
  );
  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);
  const mark = composer(page).getByRole("button", { name: "Mark as replied" });

  await mark.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Could not save the reply")).toBeVisible();
  await expect(mark).toBeFocused();
  await expect(mark).not.toHaveAttribute("aria-disabled", "true");
});

test("pressing Mark as replied twice while it runs sends one request", async ({
  page,
}) => {
  await slowReplies(page);
  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);
  const patches: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH") patches.push(request.url());
  });
  const mark = composer(page).getByRole("button", { name: "Mark as replied" });

  await mark.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(
    composer(page).getByRole("button", { name: "Undo" }),
  ).toBeVisible();

  expect(patches).toHaveLength(1);
});

test("the first click after typing marks the review while the text saves", async ({
  page,
}) => {
  await page.route("**/api/backend/apps/*/reviews/*/reply", async (route) => {
    if (route.request().postDataJSON()?.replied === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await route.continue();
  });
  await page.goto(`${REPLIES_PAGE}?reply=rep-3`);
  const article = articleOf(page, "Please add dark mode.");

  await composer(page)
    .getByRole("textbox", { name: "Reply text" })
    .fill("Dark mode ships next month.");
  await composer(page)
    .getByRole("button", { name: "Mark as replied" })
    .click({ delay: 150 });

  await expect(article.getByText("Marked replied")).toBeVisible();
  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toHaveValue("Dark mode ships next month.");
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

test("emptying a saved reply says it stays until discard and sends nothing", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/reply") && request.method() !== "GET") {
      writes.push(request.method());
    }
  });
  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);
  await page.waitForLoadState("networkidle");
  const article = articleOf(page, "Crashes often");
  const textbox = composer(page).getByRole("textbox", { name: "Reply text" });
  const hint = composer(page).getByText(
    "Emptying the field keeps the saved reply. Press Discard to remove it.",
  );
  await expect(hint).toHaveCount(0);

  await textbox.fill("");
  await textbox.blur();

  await expect(hint).toBeVisible();
  await expect(article.getByText("Draft saved")).toBeVisible();
  expect(writes).toEqual([]);

  await page.reload();
  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toHaveValue(/^Sorry about the crash, Jordan/);
  await expect(hint).toHaveCount(0);
});

test("the hint goes once the reply is discarded and never shows without one", async ({
  page,
}) => {
  await page.goto(`${REPLIES_PAGE}?reply=rep-3`);
  await page.waitForLoadState("networkidle");
  const textbox = composer(page).getByRole("textbox", { name: "Reply text" });
  const hint = composer(page).getByText(
    /Emptying the field keeps the saved reply/,
  );

  await textbox.fill("");
  await expect(hint).toHaveCount(0);

  await page.goto(`${REPLIES_PAGE}?reply=rep-2`);
  await page.waitForLoadState("networkidle");
  const saved = composer(page).getByRole("textbox", { name: "Reply text" });
  await saved.fill("");
  await expect(hint).toBeVisible();
  await saved.fill("Sorry");
  await expect(hint).toHaveCount(0);
  await saved.fill("");
  await expect(hint).toBeVisible();

  await composer(page).getByRole("button", { name: "Discard" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Discard" })
    .click();

  await expect(hint).toHaveCount(0);
});

test("the existing play reply is shown read only above the composer", async ({
  page,
}) => {
  await page.goto(`${GP_PAGE}?reply=gp-rev-1`);

  await expect(
    articleOf(page, "Stürzt ab").getByText(/^Developer reply/),
  ).toHaveCount(1);
  await expect(
    composer(page).getByText(
      "Google Play already shows a reply; a new text here replaces it when you post it in the console.",
    ),
  ).toBeVisible();
  await expect(composer(page).getByRole("textbox")).toHaveValue("");
});

const enableAi = (
  context: BrowserContext,
  extra: Record<string, string> = {},
) => seedCookies(context, { e2e_metadata_ai: "1", ...extra });

const REFUSAL: ApiErrorEnvelope = {
  statusCode: 429,
  error: "Too Many Requests",
  message: "The monthly AI allowance is spent.",
  path: `/apps/${APP_REPLIES_ID}/reviews/rep-1/reply/draft`,
  timestamp: "2026-10-17T10:00:00.000Z",
  aiAllowance: {
    plan: "indie",
    limit: 200,
    used: 200,
    resetsAt: "2026-11-01T00:00:00.000Z",
    upgradeTo: "ultimate",
  },
  retryAfterSeconds: 1_260_000,
};

test("the ai controls are hidden without a key", async ({ page }) => {
  await page.goto("/apps/app-1/reviews?reply=rev-3");

  await expect(composer(page).getByRole("textbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Draft with AI" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Reply guidelines" }),
  ).toHaveCount(0);
});

test("drafting fills the textarea and keeps it", async ({ page, context }) => {
  await enableAi(context);
  await page.goto(`${REPLIES_PAGE}?reply=rep-1`);
  const article = articleOf(page, "Love the focus timer");

  await composer(page).getByRole("combobox", { name: "Tone" }).click();
  await page.getByRole("option", { name: "Friendly" }).click();
  await composer(page)
    .getByRole("textbox", { name: "Instructions (optional)" })
    .fill("Mention the new widgets");
  const [request] = await Promise.all([
    page.waitForRequest((candidate) =>
      candidate.url().endsWith("/reviews/rep-1/reply/draft"),
    ),
    composer(page).getByRole("button", { name: "Draft with AI" }).click(),
  ]);

  expect(request.postDataJSON()).toEqual({
    tone: "friendly",
    instructions: "Mention the new widgets",
  });
  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toHaveValue(REVIEW_REPLY_DRAFT.text);
  await expect(composer(page).getByText("Drafted in English")).toBeVisible();
  await expect(article.getByText("Draft saved")).toBeVisible();
  await expect(
    composer(page).getByRole("button", { name: "Draft again" }),
  ).toBeVisible();
});

test("a fitted draft says so", async ({ page, context }) => {
  await enableAi(context, { e2e_reply_truncated: "1" });
  await page.goto(`${GP_PAGE}?reply=gp-rev-2`);

  await composer(page).getByRole("button", { name: "Draft with AI" }).click();

  await expect(
    composer(page).getByText(
      "Shortened to fit Google Play's 350 characters; read it before you copy.",
    ),
  ).toBeVisible();
});

test("a refused draft shows the allowance toast", async ({ page, context }) => {
  await enableAi(context);
  await page.route("**/api/backend/apps/*/reviews/*/reply/draft", (route) =>
    route.fulfill(fulfillJson(429, REFUSAL)),
  );
  await page.goto(`${REPLIES_PAGE}?reply=rep-1`);

  await composer(page).getByRole("button", { name: "Draft with AI" }).click();

  await expect(
    page.getByText(
      "This workspace has used the 200 AI calls its plan includes this month. Renews Nov 1, 2026.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "See plans" })).toBeVisible();
  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toHaveValue("");
});

test("reply guidelines are saved and read back", async ({ page, context }) => {
  await enableAi(context);
  await page.goto(REPLIES_PAGE);
  const text = "Sign as the Tomato team. Support: help@tomato.app";

  await page.getByRole("button", { name: "Reply guidelines" }).click();
  const dialog = page.getByRole("dialog", { name: "Reply guidelines" });
  await expect(dialog).toHaveAccessibleDescription(/Every AI draft/);
  await dialog.getByRole("textbox", { name: "Reply guidelines" }).fill(text);
  await expect(dialog.getByText("49 / 1000")).toBeVisible();
  const [request] = await Promise.all([
    page.waitForRequest((candidate) => candidate.method() === "PUT"),
    dialog.getByRole("button", { name: "Save" }).click(),
  ]);

  expect(request.postDataJSON()).toEqual({ guidelines: text });
  await expect(page.getByText("Reply guidelines saved")).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Reply guidelines" }).click();

  await expect(
    page
      .getByRole("dialog", { name: "Reply guidelines" })
      .getByRole("textbox", { name: "Reply guidelines" }),
  ).toHaveValue(text);
});

test("two clicks spend one call", async ({ page, context }) => {
  await enableAi(context);
  const drafts: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/reply/draft")) drafts.push(request.url());
  });
  await page.goto(`${REPLIES_PAGE}?reply=rep-1`);

  await composer(page)
    .getByRole("button", { name: "Draft with AI" })
    .dblclick();

  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toHaveValue(REVIEW_REPLY_DRAFT.text);
  expect(drafts).toHaveLength(1);
});

test("the drafted notice goes once the text is edited", async ({
  page,
  context,
}) => {
  await enableAi(context);
  await page.goto(`${REPLIES_PAGE}?reply=rep-1`);

  await composer(page).getByRole("button", { name: "Draft with AI" }).click();
  await expect(composer(page).getByText("Drafted in English")).toBeVisible();
  await composer(page)
    .getByRole("textbox", { name: "Reply text" })
    .press("End");
  await composer(page).getByRole("textbox", { name: "Reply text" }).press("!");

  await expect(composer(page).getByText("Drafted in English")).toBeHidden();
});

test("undo stays available while the text runs past the limit", async ({
  page,
}) => {
  await page.goto(`${GP_PAGE}?reply=gp-rev-2`);
  await composer(page).getByRole("button", { name: "Mark as replied" }).click();
  await expect(
    composer(page).getByRole("button", { name: "Undo" }),
  ).toBeVisible();

  await composer(page)
    .getByRole("textbox", { name: "Reply text" })
    .fill("a".repeat(351));

  await expect(
    composer(page).getByRole("button", { name: "Undo" }),
  ).toBeEnabled();
});

test("exporting a search that matches nothing writes no file", async ({
  page,
}) => {
  await page.goto("/apps/app-1/reviews?q=zzzz");
  const downloads: string[] = [];
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );

  await page.getByRole("button", { name: "Export reviews to CSV" }).click();

  await expect(
    page.getByText("Nothing to export: no review matches this search"),
  ).toBeVisible();
  expect(downloads).toEqual([]);
});

test("opening the composer moves focus to the text and closing it returns focus", async ({
  page,
}) => {
  await page.goto(REPLIES_PAGE);
  const article = articleOf(page, "Please add dark mode.");
  const replyButton = article.getByRole("button", { name: /^Reply to/ });

  await replyButton.click();

  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toBeFocused();

  await composer(page).getByRole("button", { name: "Close" }).click();

  await expect(composer(page)).toHaveCount(0);
  await expect(replyButton).toBeFocused();
});

test("a queue with nothing left to answer says so", async ({ page }) => {
  await page.goto(`${GP_PAGE}?reply=gp-rev-2`);

  await composer(page).getByRole("button", { name: "Mark as replied" }).click();
  await expect(
    strip(page).getByRole("button", { name: /Needs reply/ }),
  ).toContainText("0");

  await page.goto(`${GP_PAGE}?replyState=needs_reply`);

  await expect(page.getByText("Nothing needs a reply")).toBeVisible();

  await page.getByRole("button", { name: "Show all reviews" }).click();

  await expect(page).not.toHaveURL(/replyState=/);
  await expect(page.getByRole("article")).toHaveCount(3);
});

test("a review in another language is translated once and toggles back", async ({
  page,
  context,
}) => {
  await enableAi(context);
  await page.goto(GP_PAGE);
  const article = articleOf(page, "Lena");

  const [request] = await Promise.all([
    page.waitForRequest(
      (candidate) =>
        candidate.method() === "POST" &&
        candidate.url().endsWith(`/reviews/gp-rev-1/translation`),
    ),
    article.getByRole("button", { name: "Translate" }).click(),
  ]);

  expect(request.postDataJSON()).toEqual({ language: "en" });
  await expect(article.getByText("The app crashes on start.")).toBeVisible();
  await expect(article.getByText("Translated from German by AI")).toBeVisible();

  await article.getByRole("button", { name: "Show original" }).click();

  await expect(
    article.getByText("Die App stürzt beim Start ab."),
  ).toBeVisible();

  let posted = false;
  page.on("request", (candidate) => {
    if (candidate.url().endsWith("/translation")) posted = true;
  });
  await article.getByRole("button", { name: "Show translation" }).click();

  await expect(article.getByText("The app crashes on start.")).toBeVisible();
  expect(posted).toBe(false);
});

test("translation is offered only with a key and only for another language", async ({
  page,
  context,
}) => {
  await page.goto(GP_PAGE);
  await expect(page.getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Translate" })).toHaveCount(0);

  await enableAi(context);
  await page.goto(REPLIES_PAGE);

  await expect(
    articleOf(page, "Please add dark mode.").getByRole("button", {
      name: /^Reply to/,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Translate" })).toHaveCount(0);
});

test("two saves in a row keep the newer text even when the first answers last", async ({
  page,
}) => {
  await page.route("**/api/backend/apps/*/reviews/*/reply", async (route) => {
    if (route.request().postDataJSON()?.text === "First reply") {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    await route.continue();
  });
  await page.goto(`${REPLIES_PAGE}?reply=rep-3`);
  const textbox = composer(page).getByRole("textbox", { name: "Reply text" });

  await textbox.fill("First reply");
  await textbox.blur();
  await textbox.fill("Second reply");
  const settled = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.request().postDataJSON()?.text === "Second reply",
  );
  await textbox.blur();
  await settled;
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();

  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toHaveValue("Second reply");
});

test("going back to an earlier text while a save waits keeps the text typed last", async ({
  page,
}) => {
  await page.route("**/api/backend/apps/*/reviews/*/reply", async (route) => {
    if (route.request().postDataJSON()?.text === "First reply") {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    await route.continue();
  });
  await page.goto(`${REPLIES_PAGE}?reply=rep-3`);
  const textbox = composer(page).getByRole("textbox", { name: "Reply text" });
  const saved = (text: string) =>
    page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.request().postDataJSON()?.text === text,
    );

  await textbox.fill("First reply");
  await textbox.blur();
  await textbox.fill("Second reply");
  await textbox.blur();
  const second = saved("Second reply");
  await textbox.fill("First reply");
  await textbox.blur();
  await second;
  await page.waitForTimeout(300);
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();

  await expect(
    composer(page).getByRole("textbox", { name: "Reply text" }),
  ).toHaveValue("First reply");
});

test("copying without a clipboard says so instead of failing silently", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: undefined });
  });
  await page.goto(`${REPLIES_PAGE}?reply=rep-3`);

  await composer(page)
    .getByRole("textbox", { name: "Reply text" })
    .fill("Dark mode ships next month.");
  await composer(page).getByRole("button", { name: "Copy" }).click();

  await expect(page.getByText(/Couldn't copy/)).toBeVisible();
});
