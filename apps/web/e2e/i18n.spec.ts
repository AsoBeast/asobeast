import { expect, test } from "./reporting.mts";

test.describe("locale preference", () => {
  test.use({
    locale: "zh-CN",
    extraHTTPHeaders: { "Accept-Language": "zh-CN" },
  });

  test("follows the browser language and remembers a manual choice", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("combobox", { name: "语言" })).toBeVisible();

    await page.getByRole("combobox", { name: "语言" }).click();
    await page.getByRole("option", { name: "English" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect
      .poll(
        async () =>
          (await page.context().cookies()).find(
            (cookie) => cookie.name === "asobeast_locale",
          )?.value,
      )
      .toBe("en");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
