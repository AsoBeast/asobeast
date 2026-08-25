import { expect, test } from "./session.mts";
import { RATE_LIMIT_RESET_SECONDS } from "./fixtures.mts";

test("a refused dashboard load names the plan budget and the wait", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "portfolio_rate_limited",
      value: "1",
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/");

  const alert = page.getByRole("main").getByRole("alert");

  await expect(alert).toContainText(/plan/i);
  await expect(alert).toContainText(/budget/i);
  await expect(alert).toContainText(`${RATE_LIMIT_RESET_SECONDS} seconds`);
  await expect(alert).not.toContainText("The request could not be completed");
});
