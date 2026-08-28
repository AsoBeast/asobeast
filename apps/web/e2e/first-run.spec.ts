import { expect, test } from "./session.mts";
import {
  APP_1_DETAIL,
  FIRST_RUN_MID,
  FIRST_RUN_UNSCHEDULED,
} from "./fixtures.mts";

const MID_RUN_APP = FIRST_RUN_MID.appId;

test("a mid run app names what is still finishing", async ({ page }) => {
  await page.goto(`/apps/${MID_RUN_APP}`);

  const panel = page.getByRole("list", { name: /still finishing/i });
  await expect(panel).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "3 steps are still finishing." }),
  ).toBeVisible();

  const scores = panel.getByRole("listitem").filter({
    hasText: "Traffic and difficulty scored",
  });
  await expect(scores).toContainText("1 of 8");
  await expect(scores).toContainText("weekly run");
});

test("a fully collected app renders no panel at all", async ({ page }) => {
  await page.goto(`/apps/${APP_1_DETAIL.id}`);

  await expect(page.getByText(/steps are still finishing/i)).toHaveCount(0);
  await expect(page.getByText(/step is still finishing/i)).toHaveCount(0);
  await expect(page.getByText("Positions collected")).toHaveCount(0);
});

test("an unreadable schedule is reported as queued rather than as a date", async ({
  page,
}) => {
  await page.goto(`/apps/${FIRST_RUN_UNSCHEDULED.appId}`);

  const rankings = page
    .getByRole("listitem")
    .filter({ hasText: "Positions collected" });

  await expect(rankings).toContainText("queued rather than scheduled");
  await expect(rankings).not.toContainText(/\d{4}/);
});

test("the timeline is a real list every stage is announced from", async ({
  page,
}) => {
  await page.goto(`/apps/${MID_RUN_APP}`);

  const panel = page.getByRole("list", { name: /still finishing/i });
  await expect(panel.getByRole("listitem")).toHaveCount(6);
  await expect(panel.getByRole("listitem").first()).toContainText(
    "Listing captured",
  );
  await expect(panel.getByRole("listitem").last()).toContainText(
    "Daily history",
  );
});
