import type { Page } from "@playwright/test";
import {
  expectFocusKeptWhileHeld,
  holdRequest,
  pressFromKeyboard,
} from "./held-request.mts";
import { expect, test } from "./session.mts";
import { STORE_CONNECTION_COOKIE } from "./store-connections.mts";

const storeConnections = (page: Page) =>
  page.getByRole("region", { name: "Store connections" });

test.describe("store connection controls keep focus", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: STORE_CONNECTION_COOKIE,
        value: "active",
        domain: "localhost",
        path: "/",
      },
    ]);
  });

  for (const [name, path] of [
    ["Verify", /\/api\/backend\/store-connections\/APP_STORE\/verify$/],
    ["Sync now", /\/api\/backend\/store-connections\/APP_STORE\/sync$/],
  ] as const) {
    test(`${name} keeps focus while its request runs`, async ({ page }) => {
      const held = await holdRequest(page, path, "POST");
      await page.goto("/integrations#store-connections");
      const control = storeConnections(page).getByRole("button", {
        name,
        exact: true,
      });

      await pressFromKeyboard(control);

      await expectFocusKeptWhileHeld(control, held);
    });
  }

  test("closing the disconnect dialog returns focus to its opener", async ({
    page,
  }) => {
    await page.goto("/integrations#store-connections");
    const opener = storeConnections(page).getByRole("button", {
      name: "Disconnect",
    });

    await pressFromKeyboard(opener);
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("alertdialog")).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("a confirmed disconnect hands focus to the connect button", async ({
    page,
  }) => {
    await page.goto("/integrations#store-connections");

    await pressFromKeyboard(
      storeConnections(page).getByRole("button", { name: "Disconnect" }),
    );
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Disconnect" })
      .press("Enter");

    await expect(
      storeConnections(page).getByRole("button", {
        name: "Connect App Store Connect",
      }),
    ).toBeFocused();
  });
});

test.describe("the annotation remove dialog returns focus", () => {
  for (const close of ["Escape", "Cancel"] as const) {
    test(`to its trash button after ${close}`, async ({ page }) => {
      await page.goto("/apps/app-1/rankings");
      const remove = page.getByRole("button", {
        name: "Remove Autumn campaign",
      });

      await pressFromKeyboard(remove);
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      if (close === "Escape") await page.keyboard.press("Escape");
      else await dialog.getByRole("button", { name: "Cancel" }).press("Enter");

      await expect(dialog).toBeHidden();
      await expect(remove).toBeFocused();
    });
  }
});
