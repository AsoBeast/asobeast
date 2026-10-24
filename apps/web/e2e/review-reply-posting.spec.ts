import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./session.mts";
import { APP_GP_POSTING_ID, APP_POSTING_ID } from "./fixtures.mts";
import { REPLY_POST_COOKIE } from "./review-replies.mts";
import { seedCookies } from "./routes.mts";
import {
  PLAY_CONNECTION_COOKIE,
  REPLY_ACCESS_COOKIE,
  STORE_CONNECTION_COOKIE,
} from "./store-connections.mts";

const MOCK_API_URL = `http://localhost:${process.env.MOCK_API_PORT ?? 4100}`;
const DRAFTED = `/apps/${APP_POSTING_ID}/reviews?reply=rep-2`;
const PLAY_REVIEW = `/apps/${APP_GP_POSTING_ID}/reviews?reply=gp-rev-2`;
const DRAFT_TEXT =
  "Sorry about the crash, Jordan. Version 3.4.1 fixes it; please update and tell us if it persists.";
const PLAY_NO_WITHDRAW =
  "Google Play offers no way to remove a reply through its API. Edit it here and post again, or remove it in Play Console.";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  for (const id of [APP_POSTING_ID, APP_GP_POSTING_ID]) {
    await request.post(`${MOCK_API_URL}/__reset/review-replies/${id}`, {
      failOnStatusCode: true,
    });
  }
});

const composer = (page: Page) =>
  page.getByRole("region", { name: "Reply to review" });

const articleOf = (page: Page, text: string) =>
  page.getByRole("article").filter({ hasText: text });

const repliedCount = (page: Page) =>
  page
    .getByRole("region", { name: "Reply status" })
    .getByRole("button", { name: /^Replied/ });

const connect = (context: BrowserContext, cookies: Record<string, string>) =>
  seedCookies(context, cookies);

const isPost =
  (method: string) => (request: { method(): string; url(): string }) =>
    request.method() === method && request.url().endsWith("/reply/post");

async function postFromComposer(page: Page, label = "Post to App Store") {
  await composer(page).getByRole("button", { name: label }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Post this reply publicly?",
  });
  await expect(dialog).toBeVisible();
  await Promise.all([
    page.waitForRequest(isPost("POST")),
    dialog.getByRole("button", { name: "Post", exact: true }).click(),
  ]);
  return dialog;
}

test("posts a kept reply to the app store after confirming its text and rules", async ({
  page,
  context,
}) => {
  await connect(context, { [STORE_CONNECTION_COOKIE]: "active" });
  await page.goto(DRAFTED);
  const before = Number(
    (await repliedCount(page).textContent())?.match(/\d+/)?.[0] ?? "0",
  );

  await composer(page)
    .getByRole("button", { name: "Post to App Store" })
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Post this reply publicly?",
  });
  await expect(dialog).toContainText(DRAFT_TEXT);
  await expect(dialog).toContainText(
    "A review has one reply, so posting again replaces it.",
  );
  await expect(dialog).toContainText("Apple shows it within 24 hours.");
  await Promise.all([
    page.waitForRequest(isPost("POST")),
    dialog.getByRole("button", { name: "Post", exact: true }).click(),
  ]);

  await expect(
    page.getByText(
      "Posted to App Store Connect. Apple publishes it within 24 hours.",
    ),
  ).toBeVisible();
  await expect(
    articleOf(page, "It crashes when I start a session.").getByText(
      "Pending publication",
    ),
  ).toBeVisible();
  await expect(repliedCount(page)).toContainText(String(before + 1));
  await expect(page).toHaveURL(/reply=rep-2/);
  await expect(composer(page).getByRole("textbox")).toBeFocused();
  await expect(
    composer(page).getByRole("button", { name: /^Post to|^Update on/ }),
  ).toHaveCount(0);
});

test("saves typed text before posting it", async ({ page, context }) => {
  await connect(context, { [STORE_CONNECTION_COOKIE]: "active" });
  await page.goto(DRAFTED);
  const methods: string[] = [];
  page.on("request", (request) => {
    if (/\/reviews\/rep-2\/reply(\/post)?$/.test(request.url())) {
      methods.push(`${request.method()} ${request.url().split("/").pop()}`);
    }
  });

  await composer(page)
    .getByRole("textbox", { name: "Reply text" })
    .fill("Fixed in 3.4.1, thanks for the report.");
  const dialog = await postFromComposer(page);

  await expect(dialog).toBeHidden();
  expect(methods).toEqual(["PATCH reply", "POST post"]);
  await expect(page.getByText("Pending publication")).toBeVisible();
});

test("posts a google play reply and says google offers no withdraw", async ({
  page,
  context,
}) => {
  await connect(context, { [PLAY_CONNECTION_COOKIE]: "active" });
  await page.goto(PLAY_REVIEW);

  await composer(page)
    .getByRole("textbox", { name: "Reply text" })
    .fill("Danke, wir zeigen weniger Werbung.");
  await postFromComposer(page, "Post to Google Play");

  await expect(page.getByText("Posted on Google Play.")).toBeVisible();
  await expect(
    articleOf(page, "Zu viel Werbung.").getByText("Posted", { exact: true }),
  ).toBeVisible();
  await expect(composer(page)).toContainText(PLAY_NO_WITHDRAW);
  await expect(
    composer(page).getByRole("button", { name: /Withdraw/ }),
  ).toHaveCount(0);
  await composer(page).getByRole("button", { name: "Discard" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Discard this reply?" }),
  ).toContainText("The reply posted on Google Play stays there.");
});

test("without a connection the composer copies and points to integrations", async ({
  page,
}) => {
  await page.goto(DRAFTED);

  await expect(
    composer(page).getByRole("button", { name: "Copy" }),
  ).toBeVisible();
  await expect(
    composer(page).getByRole("button", { name: "Mark as replied" }),
  ).toBeVisible();
  await expect(composer(page)).toContainText(
    "Connect App Store Connect in Integrations to post replies from here.",
  );
  await expect(
    composer(page).getByRole("link", { name: "Open store connections" }),
  ).toHaveAttribute("href", "/integrations#store-connections");
  await expect(
    composer(page).getByRole("button", { name: "Post to App Store" }),
  ).toHaveCount(0);
});

test("a key without the reply role or a rejected key shows why and no post button", async ({
  page,
  context,
}) => {
  await connect(context, {
    [STORE_CONNECTION_COOKIE]: "active",
    [REPLY_ACCESS_COOKIE]: "forbidden",
  });
  await page.goto(DRAFTED);
  await expect(composer(page)).toContainText(
    "This App Store Connect key cannot respond to reviews. Connect a key with the Admin or Customer Support role.",
  );
  await expect(
    composer(page).getByRole("button", { name: "Post to App Store" }),
  ).toHaveCount(0);

  await connect(context, {
    [STORE_CONNECTION_COOKIE]: "rejected",
    [REPLY_ACCESS_COOKIE]: "",
  });
  await page.reload();
  await expect(composer(page)).toContainText(
    "App Store Connect refused the connected key.",
  );
  await expect(
    composer(page).getByRole("button", { name: "Post to App Store" }),
  ).toHaveCount(0);
});

for (const [failure, message] of [
  ["forbidden", "cannot respond to reviews"],
  ["refused", "App Store Connect refused the reply"],
  ["missing", "This review was not found in App Store Connect"],
  ["unreachable", "App Store Connect did not answer"],
  ["ratelimited", "asked to slow down"],
] as const) {
  test(`a ${failure} post toasts the store's answer and keeps the draft`, async ({
    page,
    context,
  }) => {
    await connect(context, {
      [STORE_CONNECTION_COOKIE]: "active",
      [REPLY_POST_COOKIE]: failure,
    });
    await page.goto(DRAFTED);
    const post = composer(page).getByRole("button", {
      name: "Post to App Store",
    });

    await post.click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Post", exact: true })
      .click();

    await expect(post).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText(message)).toBeVisible();
    await expect(
      articleOf(page, "It crashes when I start a session.").getByText(
        "Draft saved",
      ),
    ).toBeVisible();
    await expect(post).not.toHaveAttribute("aria-disabled");
  });
}

test("marks a reply as replied without posting it", async ({
  page,
  context,
}) => {
  await connect(context, { [STORE_CONNECTION_COOKIE]: "active" });
  await page.goto(DRAFTED);

  await composer(page)
    .getByRole("button", { name: "Mark as replied without posting" })
    .click();

  await expect(page.getByText("Marked replied")).toBeVisible();
  await expect(
    composer(page).getByRole("button", { name: "Undo" }),
  ).toBeVisible();
});

test("an edited posted reply is updated on the app store", async ({
  page,
  context,
}) => {
  await connect(context, { [STORE_CONNECTION_COOKIE]: "active" });
  await page.goto(DRAFTED);
  await postFromComposer(page);
  await expect(page.getByText("Pending publication")).toBeVisible();

  const text = composer(page).getByRole("textbox", { name: "Reply text" });
  await text.fill("Version 3.4.2 fixes it for good.");
  await text.blur();

  await expect(page.getByText("Edited since posting")).toBeVisible();
  await postFromComposer(page, "Update on App Store");
  await expect(page.getByText("Pending publication")).toBeVisible();
});

test("withdraws a posted app store response and keeps the text", async ({
  page,
  context,
}) => {
  await connect(context, { [STORE_CONNECTION_COOKIE]: "active" });
  await page.goto(DRAFTED);
  await postFromComposer(page);
  await expect(page.getByText("Pending publication")).toBeVisible();

  await expect(
    composer(page).getByRole("button", { name: "Discard" }),
  ).toHaveCount(0);

  await composer(page)
    .getByRole("button", { name: "Withdraw from App Store" })
    .click();
  const dialog = page.getByRole("alertdialog", {
    name: "Withdraw this response?",
  });
  await expect(dialog).toContainText(
    "Apple removes it within a day. The text stays here.",
  );
  await Promise.all([
    page.waitForRequest(isPost("DELETE")),
    dialog.getByRole("button", { name: "Withdraw" }).click(),
  ]);

  await expect(
    articleOf(page, "It crashes when I start a session.").getByText(
      "Draft saved",
    ),
  ).toBeVisible();
  await expect(composer(page).getByRole("textbox")).toHaveValue(DRAFT_TEXT);
  await expect(composer(page).getByRole("textbox")).toBeFocused();
  await expect(
    composer(page).getByRole("button", { name: "Post to App Store" }),
  ).toBeVisible();
});
