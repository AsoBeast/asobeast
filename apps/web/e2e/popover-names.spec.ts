import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { hydrated } from "./hydrated.mts";
import { expect, test } from "./session.mts";
import { seedChecklist } from "./workspace-checklist.mts";

interface NamedPopover {
  name: string;
  where?: string;
  path: string;
  open: (page: Page) => Promise<void>;
}

const POPOVERS: NamedPopover[] = [
  {
    name: "Setup checklist",
    path: "/apps/app-1",
    open: async (page) => {
      await seedChecklist(page.context(), "partial");
      await page.reload();
      const pill = page.getByRole("button", {
        name: /done in the setup checklist$/,
      });
      await (await hydrated(pill)).click();
    },
  },
  {
    name: "Choose captured day",
    path: "/charts?view=table",
    open: (page) => page.getByRole("button", { name: /^Captured day/ }).click(),
  },
  {
    name: "Choose captured day",
    where: "the search results sheet",
    path: "/apps/app-1/keywords?serp=kw-3",
    open: (page) =>
      page
        .getByRole("dialog", { name: "Search results" })
        .getByRole("button", { name: /^Captured day/ })
        .click(),
  },
  {
    name: "Switch app",
    path: "/apps/app-1/keywords",
    open: (page) => page.getByRole("button", { name: /^Switch app/ }).click(),
  },
  {
    name: "Position history focus timer",
    path: "/apps/app-1/keywords",
    open: (page) =>
      page
        .getByRole("button", { name: /^Position history: focus timer/ })
        .click(),
  },
  {
    name: "Zone thresholds",
    path: "/apps/app-map/keywords?view=map",
    open: (page) => page.getByRole("button", { name: "Thresholds" }).click(),
  },
  {
    name: "Quick wins",
    where: "the opportunity map legend",
    path: "/apps/app-map/keywords?view=map",
    open: (page) =>
      page.getByRole("button", { name: "About Quick wins" }).click(),
  },
  {
    name: "Position history focus timer",
    where: "the opportunity map",
    path: "/apps/app-map/keywords?view=map",
    open: async (page) => {
      await page.locator('[data-map-keyword="kw-map-1"]').focus();
      await page.keyboard.press("Enter");
    },
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
  {
    name: "Filter by app",
    path: "/alerts",
    open: (page) =>
      page.getByRole("button", { name: /^Filter by app/ }).click(),
  },
  {
    name: "Filter by event type",
    path: "/alerts",
    open: (page) =>
      page.getByRole("button", { name: /^Filter by event type/ }).click(),
  },
  {
    name: "Keyword types",
    path: "/apps/app-1/keywords",
    open: (page) =>
      page.getByRole("button", { name: "About keyword types" }).click(),
  },
  {
    name: "How actions are generated",
    path: "/actions",
    open: (page) =>
      page.getByRole("button", { name: /how actions are generated/i }).click(),
  },
  {
    name: "How ratings by market are read",
    path: "/apps/app-1",
    open: (page) =>
      page.getByRole("button", { name: "About ratings by market" }).click(),
  },
  {
    name: "Insights",
    path: "/apps/app-1/keywords",
    open: (page) =>
      page.getByRole("button", { name: "About insights" }).click(),
  },
  {
    name: "Insights",
    where: "a keyword row",
    path: "/apps/app-1/keywords",
    open: (page) =>
      page
        .getByRole("button", { name: /: reasons for pomodoro \(US\)$/ })
        .click(),
  },
  {
    name: "How the gap lists are chosen",
    path: "/apps/app-1/competitors",
    open: (page) =>
      page.getByRole("button", { name: "About gap analysis" }).click(),
  },
  ...["Rank", "Relevance", "Opportunity"].map((metric) => ({
    name: metric,
    where: "the discovered keywords",
    path: "/apps/app-1/keywords?tab=discovered",
    open: (page: Page) =>
      page
        .getByRole("button", { name: `About ${metric.toLowerCase()}` })
        .click(),
  })),
  {
    name: "Competitors in the top 10",
    path: "/apps/app-1/keywords",
    open: async (page) => {
      await page.getByRole("button", { name: "Columns" }).click();
      await page
        .getByRole("menuitemcheckbox", { name: "Competitors in top 10" })
        .click();
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "About competitors in the top 10" })
        .click();
    },
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
  const where = popover.where ? ` in ${popover.where}` : "";
  test(`${popover.name}${where} names its dialog`, async ({ page }) => {
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

test("About insights links the insights guide", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");
  await page.getByRole("button", { name: "About insights" }).click();

  const dialog = page.getByRole("dialog", { name: "Insights", exact: true });
  await expect(dialog).toHaveAccessibleDescription(
    "Up to 2 verdicts per keyword, worked out from the numbers on its row.",
  );
  await expect(
    dialog.getByRole("link", { name: "Read about insights" }),
  ).toHaveAttribute(
    "href",
    "https://docs.asobeast.com/guides/track-keywords#insights-and-totals",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "About insights" }),
  ).toBeFocused();
});

test("About keyword types links the keyword types page", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");
  await page.getByRole("button", { name: "About keyword types" }).click();

  const dialog = page.getByRole("dialog", {
    name: "Keyword types",
    exact: true,
  });
  await expect(dialog).toHaveAccessibleDescription(/^Own brand: /);
  const link = dialog.getByRole("link", { name: "Read about keyword types" });
  await expect(link).toHaveAttribute(
    "href",
    "https://docs.asobeast.com/concepts/keyword-types",
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "About keyword types" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Keyword", exact: true }),
  ).toBeVisible();
});
