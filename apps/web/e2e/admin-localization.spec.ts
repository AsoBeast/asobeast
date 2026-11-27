import { SIGNED_IN_ROUTES, seedCookies } from "./routes.mts";
import { expect, test } from "./session.mts";

const ADMIN_ROUTES = SIGNED_IN_ROUTES.filter(([name]) =>
  name.startsWith("admin-"),
);

const SURFACE_COPY: Record<string, string> = {
  "/admin": "漏斗",
  "/admin/conversion": "每周同期群",
  "/admin/capacity": "实例需求",
  "/admin/workspaces": "此实例上的工作区",
  "/admin/users": "此实例上的账户",
  "/admin/apps": "此实例上已跟踪的应用",
};

const NAV_LABELS = ["概览", "转化", "容量", "工作区", "用户", "应用"];

const ERROR_TITLES = [
  ["/admin", "无法加载管理概览"],
  ["/admin/conversion", "无法加载转化数据"],
  ["/admin/capacity", "无法加载实例容量"],
  ["/admin/workspaces", "无法加载工作区"],
  ["/admin/users", "无法加载账户"],
  ["/admin/apps", "无法加载已跟踪的应用"],
] as const;

test.describe("Simplified Chinese admin panel", () => {
  test.use({
    locale: "zh-CN",
    extraHTTPHeaders: { "Accept-Language": "zh-CN" },
  });

  for (const [name, path] of ADMIN_ROUTES) {
    test(`${name} renders Chinese admin chrome and content`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
      await expect(
        page.getByRole("heading", { level: 1, name: "管理面板" }),
      ).toBeVisible();
      const nav = page.getByRole("navigation", { name: "管理面板" });
      await expect(nav).toBeVisible();
      for (const label of NAV_LABELS) {
        await expect(
          nav.getByRole("link", { name: label, exact: true }),
        ).toBeVisible();
      }
      await expect(page.getByRole("main")).toContainText(SURFACE_COPY[path]);
    });
  }

  test("workspace support details render in Chinese without translating API data", async ({
    page,
    context,
  }) => {
    await seedCookies(context, { e2e_billing: "1" });
    await page.goto("/admin/workspaces?workspace=ws_ana");

    const sheet = page.getByRole("dialog", { name: "Ana Apps" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("套餐和日期", { exact: true })).toBeVisible();
    await expect(sheet.getByText("阶段", { exact: true })).toBeVisible();
    await expect(sheet.getByText("创建时间", { exact: true })).toBeVisible();
    await expect(sheet.getByText("订阅", { exact: true })).toBeVisible();
    await expect(
      sheet.getByText("active，每月续订", { exact: true }),
    ).toBeVisible();

    const limits = sheet.getByRole("table", { name: "套餐限制与用量" });
    await expect(limits.getByRole("row", { name: /^应用/ })).toContainText(
      "2 / 5",
    );
    await expect(
      limits.getByRole("row", { name: /^关键词市场/ }),
    ).toContainText("40 / 1,000");
    const onDemand = sheet.getByRole("table", { name: "按需额度" });
    await expect(onDemand.getByRole("row", { name: /^刷新/ })).toContainText(
      "每天 50 次",
    );

    const accessLog = sheet.getByRole("list", { name: "访问日志" });
    await expect(accessLog).toContainText("已查看");
    await expect(accessLog).toContainText("进行中");
    await expect(accessLog).toContainText("owner@example.com");

    const failedJobs = sheet.getByRole("heading", {
      name: "失败的应用商店任务",
    });
    await expect(failedJobs).toBeVisible();
    await expect(
      sheet.getByText("check-keyword", { exact: true }),
    ).toBeVisible();
    await expect(sheet.getByText(/App Store · 3 次尝试/)).toBeVisible();
    await expect(
      sheet.getByText(/Store answered 503 Service Unavailable/),
    ).toBeVisible();

    await expect(
      sheet.getByRole("button", { name: "运行每日任务", exact: true }),
    ).toBeVisible();
    await expect(
      sheet.getByRole("button", { name: "对账账单", exact: true }),
    ).toBeVisible();
    await expect(
      sheet.getByRole("button", { name: "暂停", exact: true }),
    ).toBeVisible();
  });

  for (const [path, title] of ERROR_TITLES) {
    test(`${path} renders its Chinese admin error boundary`, async ({
      page,
      context,
    }) => {
      await seedCookies(context, { e2e_admin_refused: "1" });
      await page.goto(path);

      const alert = page.getByRole("main").getByRole("alert");
      await expect(alert).toContainText(title);
      await expect(
        alert.getByRole("link", { name: "打开设置", exact: true }),
      ).toHaveAttribute("href", "/settings");
    });
  }
});
