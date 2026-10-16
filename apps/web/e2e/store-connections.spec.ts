import AxeBuilder from "@axe-core/playwright";
import type { BrowserContext, Page } from "@playwright/test";
import { THEMES } from "./contrast-check.mts";
import { openSettledDialog } from "./dialog.mts";
import { expect, test } from "./session.mts";
import {
  ADMIN_KEY_NEEDED,
  PLAY_BUCKET,
  PLAY_CONNECTION_COOKIE,
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
  await page.goto("/settings#store-connections");
  await expect(section(page)).toContainText("No store connected");

  const dialog = await openSettledDialog(
    page,
    "Connect App Store Connect",
    section(page),
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
  await page.goto("/settings#store-connections");
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
  await page.goto("/settings#store-connections");
  await expect(playCard(page)).toContainText("Not connected.");

  const dialog = await openSettledDialog(
    page,
    "Connect Google Play",
    playCard(page),
  );
  const key = dialog.getByLabel("Service account key", { exact: true });
  await expect(key).toHaveAttribute("type", "password");
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

  await dialog.getByLabel("Bucket id").fill(PLAY_BUCKET);
  await submit.click();

  await expect(page.getByText("Google Play Console connected")).toBeVisible();
  await expect(dialog).toBeHidden();
  const card = playCard(page);
  await expect(card).toContainText("reports@focus-123.iam.gserviceaccount.com");
  await expect(card).toContainText("a1b2c3d4e5f6");
  await expect(card).toContainText(PLAY_BUCKET);
  await expect(
    card
      .getByRole("list", { name: "Apps this service account reports" })
      .getByRole("listitem")
      .filter({ hasText: "Tomato Clock" }),
  ).toContainText("Reporting");
  await expect(section(page)).not.toContainText("BEGIN PRIVATE KEY");
  await expect(
    section(page).getByRole("button", { name: "Connect App Store Connect" }),
  ).toBeVisible();
});

test("disconnecting google play leaves app store connect alone", async ({
  page,
}) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "active");
  await seed(page.context(), PLAY_CONNECTION_COOKIE, "active");
  await page.goto("/settings#store-connections");

  await playCard(page).getByRole("button", { name: "Disconnect" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Disconnect Google Play Console?");
  await confirm.getByRole("button", { name: "Disconnect" }).click();

  await expect(
    playCard(page).getByRole("button", { name: "Connect Google Play" }),
  ).toBeVisible();
  await expect(section(page)).toContainText("2X9R4HXF34");
});

test("a member sees the state without a single control", async ({ page }) => {
  await seedViewer(page.context(), "member");
  await seed(page.context(), STORE_CONNECTION_COOKIE, "active");

  await page.goto("/settings#store-connections");

  await expect(section(page)).toContainText("2X9R4HXF34");
  await expect(section(page)).toContainText(
    "Only the workspace owner can connect a store.",
  );
  await expect(section(page).getByRole("button")).toHaveCount(0);
});

test("a rejected key leads with verify, which clears it", async ({ page }) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "rejected");
  await page.goto("/settings#store-connections");

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
  await page.goto("/settings#store-connections");

  await expect(section(page).getByRole("status")).toHaveText(ADMIN_KEY_NEEDED);
  await expect(section(page)).toContainText("Needs an Admin key");

  await section(page).getByRole("button", { name: "Sync now" }).click();

  await expect(page.getByText("Sync queued")).toBeVisible();
});

test("disconnecting asks first and returns the card to its empty state", async ({
  page,
}) => {
  await seed(page.context(), STORE_CONNECTION_COOKIE, "active");
  await page.goto("/settings#store-connections");

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

    await page.goto("/settings#store-connections");

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
    await page.goto("/settings#store-connections");
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
