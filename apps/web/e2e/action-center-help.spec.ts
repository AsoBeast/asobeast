import { expect, test } from "./session.mts";

const GUIDE = "https://docs.asobeast.com/guides/action-center";

const PAGES = [
  ["the Action Center", "/actions"],
  ["an app's Actions tab", "/apps/app-1/actions"],
] as const;

for (const [name, path] of PAGES) {
  test(`${name} links the guide from the queue's footer`, async ({ page }) => {
    await page.goto(path);

    const guide = page
      .getByRole("region", { name: "Queue", exact: true })
      .getByRole("link", { name: "How the Action Center works" });

    await expect(guide).toHaveAttribute("href", GUIDE);
    await expect(
      page.getByRole("button", { name: /how actions are generated/i }),
    ).toHaveCount(0);
  });
}

test("a queue that was never generated says how it is made", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "e2e_actions_ungenerated",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);
  await page.goto("/actions");

  const queue = page.getByRole("region", { name: "Queue", exact: true });
  await expect(queue.getByText("No actions generated yet")).toBeVisible();
  await expect(queue.getByRole("listitem")).toHaveText([
    /fixed rules read your rankings, listing, reviews and store funnel/,
    /becomes an action with its evidence/,
    /confirms the fix when the rule stops firing/,
  ]);
  await expect(page.getByRole("button", { name: "Generate now" })).toHaveCount(
    1,
  );
});
