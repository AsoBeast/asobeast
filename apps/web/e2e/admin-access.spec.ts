import { expect, test } from "./session.mts";
import { seedCookies } from "./routes.mts";
import { UNPLANNED_OPERATORS, seedViewer } from "./viewer.mts";

const DELETED_RECORD_COPY = "This app or record no longer exists";

const ADMIN_PATHS = [
  "/admin",
  "/admin/capacity",
  "/admin/workspaces",
  "/admin/users",
  "/admin/apps",
];

const NOTICE_TITLE = {
  "lapsed-operator": "Your workspace needs a plan to open the admin area",
  "unconfirmed-operator": "Confirm your email to open the admin area",
} as const;

for (const viewer of UNPLANNED_OPERATORS) {
  test.describe(`the admin area for a ${viewer}`, () => {
    test.beforeEach(async ({ context }) => {
      await seedViewer(context, viewer);
    });

    for (const path of ADMIN_PATHS) {
      test(`${path} explains why it is closed`, async ({ page }) => {
        await page.goto(path);

        await expect(
          page.getByRole("heading", { level: 1, name: "Admin" }),
        ).toBeVisible();
        await expect(
          page.getByRole("region", { name: NOTICE_TITLE[viewer] }),
        ).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Admin" }),
        ).toHaveCount(0);
        await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
        await expect(page.getByText(DELETED_RECORD_COPY)).toHaveCount(0);
      });
    }

    test("keeps the sidebar entry so the operator can find the explanation", async ({
      page,
    }) => {
      await page.goto("/");

      await expect(
        page
          .getByRole("navigation", { name: "Main" })
          .getByRole("link", { name: "Admin", exact: true }),
      ).toBeVisible();
    });
  });
}

test.describe("what the notice offers", () => {
  test("a lapsed operator can choose a plan or read the guide", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "lapsed-operator");
    await page.goto("/admin");

    const notice = page.getByRole("region", {
      name: NOTICE_TITLE["lapsed-operator"],
    });
    await expect(
      notice.getByRole("link", { name: "Choose a plan" }),
    ).toHaveAttribute("href", "/upgrade");
    await expect(
      notice.getByRole("link", { name: "Read the guide" }),
    ).toHaveAttribute(
      "href",
      "https://docs.asobeast.com/security/admin-surfaces#when-the-operators-workspace-has-no-plan",
    );
  });

  test("an operator who has not confirmed is not asked to pay", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "unconfirmed-operator");
    await page.goto("/admin");

    const notice = page.getByRole("region", {
      name: NOTICE_TITLE["unconfirmed-operator"],
    });
    await expect(notice).toBeVisible();
    await expect(
      notice.getByRole("link", { name: "Choose a plan" }),
    ).toHaveCount(0);
  });

  test("an operator with a plan sees no notice", async ({ page }) => {
    await page.goto("/admin");

    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: /to open the admin area/ }),
    ).toHaveCount(0);
  });

  test("opens on the next visit once the operator has a plan", async ({
    page,
    context,
  }) => {
    await seedViewer(context, "lapsed-operator");
    await page.goto("/admin");
    await expect(
      page.getByRole("region", { name: NOTICE_TITLE["lapsed-operator"] }),
    ).toBeVisible();

    await context.clearCookies({ name: "e2e_viewer" });
    await page.goto("/admin");

    await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  });
});

test.describe("an admin endpoint that refuses an operator with a plan", () => {
  test.beforeEach(async ({ context }) => {
    await seedCookies(context, { e2e_admin_refused: "1" });
  });

  for (const [path, title] of [
    ["/admin", "Admin overview could not be loaded"],
    ["/admin/workspaces", "Workspaces could not be loaded"],
    ["/admin/users", "Accounts could not be loaded"],
    ["/admin/apps", "Tracked apps could not be loaded"],
  ] as const) {
    test(`${path} does not claim a record was deleted`, async ({ page }) => {
      await page.goto(path);

      const alert = page.getByRole("main").getByRole("alert");
      await expect(alert).toContainText(title);
      await expect(alert).not.toContainText(DELETED_RECORD_COPY);
      await expect(alert).toContainText("plan in force");
      await expect(
        alert.getByRole("link", { name: "Open settings" }),
      ).toHaveAttribute("href", "/settings");
    });
  }
});
