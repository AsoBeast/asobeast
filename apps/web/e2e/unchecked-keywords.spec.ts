import { expect, test } from "./session.mts";
import { APP_UNCHECKED_DETAIL, APP_UNCHECKED_KEYWORDS } from "./fixtures.mts";

const NEVER_CHECKED = APP_UNCHECKED_KEYWORDS[0]!;

test("a keyword the pipeline never checked is not reported as ranking beyond depth", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_UNCHECKED_DETAIL.id}/keywords`);

  const row = page.getByRole("row", { name: new RegExp(NEVER_CHECKED.text) });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText(">200");
  await expect(row.getByLabel(/not checked yet/i)).toBeVisible();
});

test("the rankings chart offers no widen prompt when nothing was ever checked", async ({
  page,
}) => {
  await page.goto(`/apps/${APP_UNCHECKED_DETAIL.id}/rankings`);

  await expect(page.getByText("No positions captured yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Widen to 90 days" }),
  ).toHaveCount(0);
});
