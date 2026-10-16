import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./session.mts";

interface NamedPopover {
  name: string;
  path: string;
  open: (page: Page) => Promise<void>;
}

const POPOVERS: NamedPopover[] = [
  {
    name: "Choose captured day",
    path: "/charts?view=table",
    open: (page) => page.getByRole("button", { name: /^Captured day/ }).click(),
  },
  {
    name: "Switch app",
    path: "/apps/app-1/keywords",
    open: (page) => page.getByRole("button", { name: /^Switch app/ }).click(),
  },
  {
    name: "Choose keywords",
    path: "/apps/app-1/rankings",
    open: (page) => page.getByRole("button", { name: /selected$/ }).click(),
  },
  {
    name: "Tag keywords",
    path: "/apps/app-1/keywords",
    open: async (page) => {
      await page
        .getByRole("checkbox", { name: /^Select / })
        .first()
        .check();
      await page
        .getByRole("group", { name: "Bulk keyword actions" })
        .getByRole("button", { name: "Tag", exact: true })
        .click();
    },
  },
  {
    name: "Filter by source",
    path: "/apps/app-1/keywords",
    open: (page) =>
      page.getByRole("button", { name: /^Filter by source/ }).click(),
  },
];

const dialogNameViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withRules(["aria-dialog-name"])
    .analyze();
  return violations.map(({ id }) => id);
};

for (const popover of POPOVERS) {
  test(`${popover.name} names its dialog`, async ({ page }) => {
    await page.goto(popover.path);
    await popover.open(page);

    await expect(
      page.getByRole("dialog", { name: popover.name, exact: true }),
    ).toBeVisible();
    expect(await dialogNameViolations(page)).toEqual([]);
  });
}

test("the day picker dialog passes axe in both themes", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/charts?view=table");
    await page.getByRole("button", { name: /^Captured day/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    expect(await dialogNameViolations(page)).toEqual([]);
  }
});
