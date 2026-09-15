import { expect, test } from "./session.mts";

const scheduleDeletion = (requestedAt: string) => ({
  name: "workspace_deletion_requested",
  value: requestedAt,
  url: "http://localhost:3000",
});

test("a scheduled deletion is announced on every app page", async ({
  page,
}) => {
  await page.context().addCookies([scheduleDeletion(new Date().toISOString())]);

  for (const path of ["/", "/settings"]) {
    await page.goto(path);

    const banner = page.getByRole("main").getByRole("alert");
    await expect(banner).toContainText(
      "This workspace is scheduled for deletion",
    );
    await expect(
      banner.getByRole("link", { name: "Cancel deletion" }),
    ).toHaveAttribute("href", "/settings#workspace");
  }
});

test("the owner schedules deletion behind a typed confirmation and cancels it", async ({
  page,
}) => {
  await page.goto("/settings#workspace");

  const section = page.getByRole("region", { name: "Workspace" });
  await section.getByRole("button", { name: "Delete workspace" }).click();

  const dialog = page.getByRole("alertdialog");
  const confirm = dialog.getByRole("button", { name: "Delete workspace" });
  await dialog.getByLabel("Type DELETE to confirm").fill("delete");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await confirm.click();

  const banner = page.getByRole("main").getByRole("alert");
  await expect(banner).toContainText(
    "This workspace is scheduled for deletion",
  );
  await expect(section).toContainText("It is erased on or after");

  await section.getByRole("button", { name: "Cancel deletion" }).click();

  await expect(banner).toBeHidden();
  await expect(
    section.getByRole("button", { name: "Delete workspace" }),
  ).toBeVisible();
});

test("a member sees a scheduled deletion without the controls", async ({
  page,
}) => {
  await page.context().addCookies([scheduleDeletion(new Date().toISOString())]);
  await page.route("**/api/backend/auth/me", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), role: "member" },
    });
  });

  await page.goto("/settings#workspace");

  const section = page.getByRole("region", { name: "Workspace" });
  await expect(section).toContainText("It is erased on or after");
  await expect(section).toContainText(
    "Only the workspace owner can cancel this.",
  );
  await expect(section.getByRole("button")).toHaveCount(0);
});

test("the owner is never shown the member note while their account loads", async ({
  page,
}) => {
  let releaseMe: () => void = () => undefined;
  const meReleased = new Promise<void>((resolve) => {
    releaseMe = resolve;
  });
  await page.route("**/api/backend/auth/me", async (route) => {
    await meReleased;
    await route.fallback();
  });

  await page.goto("/settings#workspace");
  const section = page.getByRole("region", { name: "Workspace" });
  await expect(section).toBeVisible();
  await page.waitForResponse((response) =>
    response.url().endsWith("/api/backend/account/deletion"),
  );

  await expect(section.getByText("Only the workspace owner")).toHaveCount(0);
  releaseMe();
  await expect(
    section.getByRole("button", { name: "Delete workspace" }),
  ).toBeVisible();
});
