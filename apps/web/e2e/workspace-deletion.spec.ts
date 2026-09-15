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
