import { expect, test } from "./reporting.mts";
import { seedSession } from "./plan-helpers.mts";
import { seedViewer } from "./viewer.mts";

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

  test("translates sign-in and registration before authentication", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
    await expect(page.getByLabel("邮箱")).toBeVisible();
    await expect(page.getByLabel("密码", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "忘记密码？" })).toBeVisible();

    await page.context().addCookies([
      {
        name: "e2e_setup_required",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "创建账号" })).toBeVisible();
  });

  test("translates the signed-in shell and can switch back to English", async ({
    context,
    page,
  }) => {
    await seedSession(page);
    await seedViewer(context, "customer");
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主导航" });
    await expect(navigation).toBeVisible();
    await expect(navigation.getByText("工作区", { exact: true })).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "仪表盘" }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "行动中心" }),
    ).toBeVisible();
    await expect(navigation.getByRole("link", { name: "提醒" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "榜单" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "设置" })).toBeVisible();

    await page.getByRole("button", { name: "打开命令面板" }).click();
    await expect(page.getByPlaceholder("搜索应用和板块…")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "账号菜单" }).click();
    await page.getByRole("combobox", { name: "语言" }).click();
    await page.getByRole("option", { name: "English" }).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const englishNavigation = page.getByRole("navigation", { name: "Main" });
    await expect(englishNavigation).toBeVisible();
    await expect(
      englishNavigation.getByRole("link", { name: "Dashboard" }),
    ).toBeVisible();
  });
});
