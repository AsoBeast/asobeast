import { layoutBox } from "./layout-box.mts";
import { expect, test } from "./reporting.mts";
import { seedCookies } from "./routes.mts";

const HOSTED = { e2e_setup_required: "1", e2e_billing: "1" };

test.describe("register steps", () => {
  test("a hosted instance shows the walk with the account step current above the title", async ({
    page,
    context,
  }) => {
    await seedCookies(context, HOSTED);
    await page.goto("/register");

    const steps = page.getByRole("list", { name: "Sign up steps" });
    await expect(steps.getByRole("listitem")).toHaveText([
      /Create account/,
      /Email confirmed/,
      /Choose a plan/,
    ]);
    await expect(steps.locator("[aria-current='step']")).toHaveText(
      /Create account/,
    );
    const [stepsBox, headingBox] = await Promise.all([
      layoutBox(steps),
      layoutBox(
        page.getByRole("heading", { level: 1, name: "Create account" }),
      ),
    ]);
    expect(stepsBox.y).toBeLessThan(headingBox.y);
  });

  test("a hosted instance that sends no mail leaves the email step out", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { ...HOSTED, e2e_smtp_off: "1" });
    await page.goto("/register");

    await expect(
      page.getByRole("list", { name: "Sign up steps" }).getByRole("listitem"),
    ).toHaveText([/Create account/, /Choose a plan/]);
  });

  test("a self hosted instance shows the form alone", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_setup_required: "1" });
    await page.goto("/register");

    await expect(
      page.getByRole("heading", { level: 1, name: "Create account" }),
    ).toBeVisible();
    await expect(page.getByRole("list", { name: "Sign up steps" })).toHaveCount(
      0,
    );
  });

  test("the steps are there before the form and stay while it is filled", async ({
    page,
    context,
  }) => {
    await seedCookies(context, HOSTED);
    await page.goto("/register?plan=indie");

    const steps = page.getByRole("list", { name: "Sign up steps" });
    await expect(steps).toBeVisible();
    await page.getByLabel("Email").fill("new@example.com");
    await page.getByLabel("Password", { exact: true }).fill("supersecret1");
    await expect(steps.locator("[aria-current='step']")).toHaveText(
      /Create account/,
    );
  });
});
