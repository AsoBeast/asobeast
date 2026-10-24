import AxeBuilder from "@axe-core/playwright";
import { PLAY_REPLIES_NEED_CONSENT } from "@asobeast/shared";
import type { BrowserContext, Page } from "@playwright/test";
import { THEMES } from "./contrast-check.mts";
import { openSettledDialog } from "./dialog.mts";
import { expect, test } from "./session.mts";
import {
  ADMIN_KEY_NEEDED,
  GOOGLE_SIGN_IN_COOKIE,
  PLAY_BUCKET,
  PLAY_CONNECTION_COOKIE,
  PLAY_SIGN_IN_EXPIRED,
  REPLY_ACCESS_COOKIE,
  STORE_CONNECT_OFF_COOKIE,
  STORE_CONNECTION_COOKIE,
} from "./store-connections.mts";
import { seedViewer } from "./viewer.mts";

const PRIVATE_KEY = [
  "-----BEGIN PRIVATE KEY-----",
  "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg1CFBFvfLhHB+dVIn",
  "-----END PRIVATE KEY-----",
].join("\n");

const seed = (context: BrowserContext, name: string, value: string) =>
  context.addCookies([{ name, value, domain: "localhost", path: "/" }]);

const section = (page: Page) =>
  page.getByRole("region", { name: "Store connections" });

test("the owner connects app store connect and sees the apps it reports", async ({
  page,
}) => {
  await page.goto("/integrations#store-connections");
  await expect(section(page)).toContainText("No store connected");

  const dialog = await openSettledDialog(
    page,
    "Connect App Store Connect",
    section(page),
  );
  await expect(dialog).toHaveAccessibleDescription(
    /Create a team key with the Admin role/,
  );
  await expect(
    dialog.getByRole("link", { name: "Why an Admin key" }),
  ).toHaveAttribute(
    "href",
    "https://docs.asobeast.com/guides/store-funnel#create-the-key",
  );
  const key = dialog.getByLabel("Private key", { exact: true });
  await expect(key).toHaveAttribute("type", "password");
  await expect(key).toHaveAttribute("autocomplete", "off");
  await expect(key).toHaveAttribute("data-1p-ignore", "true");
  await expect(key).toHaveAttribute("data-lpignore", "true");
  await expect(key).toHaveAttribute("data-bwignore", "true");

  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/store-connections/"))
      sent.push(request.method());
  });
  await dialog
    .getByLabel("Issuer ID")
    .fill("57246542-96fe-1a63-e053-0824d011072a");
  await dialog.getByLabel("Key ID").fill("2X9R4HXF34");
  await dialog
    .getByRole("button", { name: "Connect App Store Connect" })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Paste the whole contents of the .p8 file",
  );
  expect(sent).toEqual([]);

  await key.fill(PRIVATE_KEY);
  await dialog
    .getByRole("button", { name: "Connect App Store Connect" })
    .click();

  await expect(page.getByText("App Store Connect connected")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(section(page)).toContainText("2X9R4HXF34");
  await expect(section(page)).toContainText("3f9a2c7d41be0e85");
  const apps = section(page).getByRole("list", {
    name: "Apps this key reports",
  });
  await expect(
    apps.getByRole("listitem").filter({ hasText: "Focus Timer" }),
  ).toContainText("Reporting");
  await expect(
    apps.getByRole("listitem").filter({ hasText: "Habit Tracker" }),
  ).toContainText("Not in this team");
  await expect(section(page)).not.toContainText("BEGIN PRIVATE KEY");
});

test("the owner reads a key from the .p8 file", async ({ page }) => {
  await page.goto("/integrations#store-connections");
  const dialog = await openSettledDialog(
    page,
    "Connect App Store Connect",
    section(page),
  );

  await dialog
    .getByLabel("Issuer ID")
    .fill("57246542-96fe-1a63-e053-0824d011072a");
  await dialog.getByLabel("Key ID").fill("2X9R4HXF34");
  await dialog.getByLabel("Private key file").setInputFiles({
    name: "AuthKey_2X9R4HXF34.p8",
    mimeType: "text/plain",
    buffer: Buffer.from(PRIVATE_KEY),
  });
  await dialog
    .getByRole("button", { name: "Connect App Store Connect" })
    .click();

  await expect(page.getByText("App Store Connect connected")).toBeVisible();
});

const SERVICE_ACCOUNT = JSON.stringify({
  type: "service_account",
  client_email: "reports@focus-123.iam.gserviceaccount.com",
  private_key_id: "a1b2c3d4e5f6",
  private_key: PRIVATE_KEY,
});

const playCard = (page: Page) =>
  section(page)
    .locator('[data-slot="card"]')
    .filter({ hasText: "Google Play Console" });

test("the owner connects the google play console with its json key file", async ({
  page,
}) => {
  await page.goto("/integrations#store-connections");
  await expect(playCard(page)).toContainText("Not connected.");

  const dialog = await openSettledDialog(
    page,
    "Connect Google Play",
    playCard(page),
  );
  const key = dialog.getByLabel("Service account key", { exact: true });
  await expect(key).toHaveAttribute("type", "password");
  await expect(key).toHaveAttribute("data-1p-ignore", "true");
  await expect(key).toHaveAttribute("data-lpignore", "true");
  const submit = dialog.getByRole("button", { name: "Connect Google Play" });

  await dialog.getByLabel("Bucket id").fill("my-reports");
  await submit.click();
  await expect(dialog).toContainText("starts with pubsite_prod");

  await dialog.getByLabel("Bucket id").fill("pubsite_prod_rev_42");
  await submit.click();
  await expect(dialog).toContainText("Choose the JSON key file");

  await dialog.getByLabel("Service account key file").setInputFiles({
    name: "focus-123-reports.json",
    mimeType: "application/json",
    buffer: Buffer.from(SERVICE_ACCOUNT),
  });
  await submit.click();
  await expect(dialog).toContainText(
    "Google Cloud Storage has no bucket pubsite_prod_rev_42",
  );

  await dialog
    .getByLabel("Bucket id")
    .fill(`gs://${PLAY_BUCKET}/stats/store_performance/`);
  await submit.click();

  await expect(page.getByText("Google Play Console connected")).toBeVisible();
  await expect(dialog).toBeHidden();
  const card = playCard(page);
  await expect(card).toContainText("reports@focus-123.iam.gserviceaccount.com");
  await expect(card).toContainText("a1b2c3d4e5f6");
  await expect(card).toContainText(PLAY_BUCKET);
  await expect(card).not.toContainText(PLAY_REPLIES_NEED_CONSENT);
  await expect(
    card
      .getByRole("list", { name: "Apps this connection reports" })
      .getByRole("listitem")
      .filter({ hasText: "Tomato Clock" }),
  ).toContainText("Reporting");
  await expect(section(page)).not.toContainText("BEGIN PRIVATE KEY");
  await expect(
    section(page).getByRole("button", { name: "Connect App Store Connect" }),
  ).toBeVisible();
});

test("the owner signs in with google and lands back on store connections", async ({
  page,
}) => {
  await seed(page.context(), GOOGLE_SIGN_IN_COOKIE, "1");
  await page.goto("/integrations#store-connections");

  const dialog = await openSettledDialog(
    page,
    "Connect Google Play",
    playCard(page),
  );
  const methods = dialog.getByRole("tablist", { name: "How to connect" });
  await expect(
    methods.getByRole("tab", { name: "Sign in with Google" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByLabel("Service account key")).toHaveCount(0);
  await expect(dialog).toHaveAccessibleDescription(
    /for access to Play Console to post the review replies you send/,
  );
  const submit = dialog.getByRole("button", { name: "Sign in with Google" });

  await submit.click();
  await expect(dialog).toContainText("starts with pubsite_prod");

  await methods.getByRole("tab", { name: "Service account key" }).click();
  await expect(
    dialog.getByLabel("Service account key", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Connect Google Play" }),
  ).toBeVisible();
  await methods.getByRole("tab", { name: "Sign in with Google" }).click();

  await dialog
    .getByLabel("Bucket id")
    .fill("gs://pubsite_prod_4855979533719537120/stats/store_performance/");
  await submit.click();

  await page.waitForURL(/\/integrations(#store-connections)?$/);
  await expect(page.getByText("Google Play Console connected")).toBeVisible();
  const card = playCard(page);
  await expect(card).toContainText("Google account");
  await expect(card).toContainText("owner@example.com");
  await expect(card).toContainText("pubsite_prod_4855979533719537120");
  await expect(card).not.toContainText("Fingerprint");
  await expect(card).not.toContainText(PLAY_REPLIES_NEED_CONSENT);
  await expect(card.getByRole("button", { name: "Reconnect" })).toBeVisible();
});

test("the google return page explains a cancelled, incomplete or refused sign in", async ({
  page,
}) => {
  const heading = page.getByRole("heading", { level: 1 });
  const back = page.getByRole("link", { name: "Back to store connections" });

  await page.goto("/integrations/google-play?error=access_denied");
  await expect(heading).toHaveText("Google sign in was cancelled");
  await expect(back).toHaveAttribute("href", "/integrations#store-connections");

  await page.goto("/integrations/google-play");
  await expect(heading).toHaveText("This sign in is incomplete");

  await page.goto("/integrations/google-play?code=4%2Fold&state=stale");
  await expect(heading).toHaveText("Google Play was not connected");
  await expect(page.getByText(PLAY_SIGN_IN_EXPIRED)).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }),
  ).toContainText("Integrations");
  await back.click();
  await expect(playCard(page)).toContainText("Not connected.");
  await expect(section(page)).toBeInViewport();
});

test("disconnecting google play leaves app store connect alone", async ({
  page,
}) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "active");
  await seed(page.context(), PLAY_CONNECTION_COOKIE, "active");
  await page.goto("/integrations#store-connections");

  await playCard(page).getByRole("button", { name: "Disconnect" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Disconnect Google Play Console?");
  await confirm.getByRole("button", { name: "Disconnect" }).click();

  await expect(
    playCard(page).getByRole("button", { name: "Connect Google Play" }),
  ).toBeVisible();
  await expect(section(page)).toContainText("2X9R4HXF34");
});

test("the card says whether the key may post review replies", async ({
  page,
  context,
}) => {
  await seed(context, STORE_CONNECTION_COOKIE, "active");
  await seed(context, PLAY_CONNECTION_COOKIE, "active");
  await page.goto("/integrations#store-connections");
  await expect(section(page).getByText("Not tried yet")).toHaveCount(2);

  await seed(context, REPLY_ACCESS_COOKIE, "forbidden");
  await page.reload();
  await expect(section(page)).toContainText(
    "This App Store Connect key cannot respond to reviews. Connect a key with the Admin or Customer Support role.",
  );
  await expect(playCard(page)).toContainText(
    "This service account cannot reply to reviews. Give it the Reply to reviews permission in Play Console.",
  );
});

test("the connect dialogs name the role a reply needs", async ({ page }) => {
  await page.goto("/integrations#store-connections");

  const apple = await openSettledDialog(
    page,
    "Connect App Store Connect",
    section(page),
  );
  await expect(apple).toContainText(
    "Sales and Reports reads reports only, Customer Support replies only.",
  );
  await page.keyboard.press("Escape");
  await expect(apple).toBeHidden();

  const play = await openSettledDialog(
    page,
    "Connect Google Play",
    playCard(page),
  );
  await expect(play).toHaveAccessibleDescription(
    /and Reply to reviews to post replies\./,
  );
});

test("a member sees the state without a single control", async ({ page }) => {
  await seedViewer(page.context(), "member");
  await seed(page.context(), STORE_CONNECTION_COOKIE, "active");

  await page.goto("/integrations#store-connections");

  await expect(section(page)).toContainText("2X9R4HXF34");
  await expect(
    section(page).getByText("Only the workspace owner can connect a store."),
  ).toHaveCount(1);
  await expect(section(page).getByRole("button")).toHaveCount(0);
});

test("a rejected key leads with verify, which clears it", async ({ page }) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "rejected");
  await page.goto("/integrations#store-connections");

  const status = section(page).getByRole("status");
  await expect(status).toHaveText(
    "App Store Connect refused this key. Check the issuer ID and the key ID, and that the key is active.",
  );
  await expect(status).toHaveClass(/text-warning/);
  await expect(section(page).getByRole("button").first()).toHaveText("Verify");
  await expect(
    section(page).getByRole("button", { name: "Sync now" }),
  ).toHaveCount(0);

  const verified = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith("/store-connections/APP_STORE/verify"),
  );
  await section(page).getByRole("button", { name: "Verify" }).click();
  await verified;

  await expect(status).toHaveText(/^Last synced/);
});

test("a read only key names the admin key and still syncs", async ({
  page,
}) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "readOnly");
  await page.goto("/integrations#store-connections");

  await expect(section(page).getByRole("status")).toHaveText(ADMIN_KEY_NEEDED);
  await expect(section(page)).toContainText("Needs an Admin key");

  await section(page).getByRole("button", { name: "Sync now" }).click();

  await expect(page.getByText("Sync queued")).toBeVisible();
});

test("a key that cannot request reports leads with replacing it", async ({
  page,
}) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "readOnly");
  await page.goto("/integrations#store-connections");

  const replace = section(page).getByRole("button", { name: "Replace key" });
  await expect(replace).toHaveAttribute("data-variant", "default");
  await expect(
    section(page).locator('button[data-variant="default"]'),
  ).toHaveCount(1);

  const dialog = await openSettledDialog(page, "Replace key", section(page));
  await dialog
    .getByLabel("Issuer ID")
    .fill("57246542-96fe-1a63-e053-0824d011072a");
  await dialog.getByLabel("Key ID").fill("2X9R4HXF34");
  await dialog.getByLabel("Private key", { exact: true }).fill(PRIVATE_KEY);
  await dialog.getByRole("button", { name: "Replace key" }).click();

  await expect(dialog).toBeHidden();
  await expect(section(page)).not.toContainText("Needs an Admin key");
  await expect(replace).toHaveAttribute("data-variant", "outline");
  await expect(replace).toBeFocused();
});

test("a key with every request in place keeps replace key quiet", async ({
  page,
}) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "active");
  await page.goto("/integrations#store-connections");

  await expect(
    section(page).getByRole("button", { name: "Replace key" }),
  ).toHaveAttribute("data-variant", "outline");
});

test("disconnecting asks first and returns the card to its empty state", async ({
  page,
}) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "active");
  await page.goto("/integrations#store-connections");

  await section(page).getByRole("button", { name: "Disconnect" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText(
    "The numbers already stored are kept and appear again once you connect a key.",
  );
  await confirm.getByRole("button", { name: "Disconnect" }).click();

  await expect(section(page)).toContainText("No store connected");
  await expect(
    section(page).getByRole("button", { name: "Connect App Store Connect" }),
  ).toBeVisible();
});

for (const viewer of ["owner", "member"] as const) {
  test(`the ${viewer} is told when store connections are off`, async ({
    page,
  }) => {
    if (viewer === "member") await seedViewer(page.context(), "member");
    await seed(page.context(), STORE_CONNECT_OFF_COOKIE, "1");

    await page.goto("/integrations#store-connections");

    await expect(section(page)).toContainText(
      "Store connections are off on this instance. Set STORE_CONNECT_ENCRYPTION_KEY to turn them on.",
    );
    await expect(section(page).getByRole("button")).toHaveCount(0);
  });
}

for (const theme of THEMES) {
  test(`the section has no accessibility violation in the ${theme} theme`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => window.localStorage.setItem("theme", value),
      theme,
    );
    await page.emulateMedia({ colorScheme: theme });
    await seed(page.context(), STORE_CONNECTION_COOKIE, "readOnly");
    await page.goto("/integrations#store-connections");
    await expect(section(page).getByRole("status")).toBeVisible();

    const { violations } = await new AxeBuilder({ page })
      .include("#store-connections")
      .analyze();

    expect(
      violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}
