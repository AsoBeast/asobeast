import { describe, expect, it, vi } from "vitest";
import { AdminAccessNotice } from "./AdminAccessNotice";
import { AdminCapacity } from "./AdminCapacity";
import { AdminConversion } from "./AdminConversion";
import { AdminHeader } from "./AdminHeader";
import { AdminNav } from "./AdminNav";
import { AdminOverview } from "./AdminOverview";
import { OverviewStrip } from "./OverviewStrip";
import { SignupsChart } from "./SignupsChart";
import { FunnelPanel } from "./overview-panels";
import {
  chineseMarkup,
  CONVERSION,
  OVERVIEW,
} from "./admin-localization-test-utils";

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { catalogs } = await import("@/i18n/messages");
  return {
    getTranslations: async (namespace?: string) =>
      createTranslator({
        locale: "zh-CN",
        namespace,
        messages: catalogs["zh-CN"] as Parameters<
          typeof createTranslator
        >[0]["messages"],
        timeZone: "UTC",
      }),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
}));

vi.mock("nuqs", () => ({
  useQueryStates: () => [{ days: 30 }, () => undefined],
  useQueryState: () => ["", () => undefined],
}));

describe("Simplified Chinese admin overview", () => {
  it("localizes the admin heading, navigation, and access notice", async () => {
    const notice = await AdminAccessNotice({ access: "needs-plan" });
    const markup = chineseMarkup(
      <>
        <AdminHeader />
        <AdminNav />
        {notice}
      </>,
    );

    expect(markup).toContain(
      '<h1 class="text-title text-balance">管理面板</h1>',
    );
    expect(markup).toContain('aria-label="管理面板"');
    for (const label of [
      "概览",
      "转化",
      "容量",
      "工作区",
      "用户",
      "应用",
      "队列仪表盘",
      "API 文档",
    ]) {
      expect(markup).toContain(`>${label}<`);
    }
    expect(markup).toContain("您的工作区需要套餐才能打开管理面板");
    expect(markup).toContain("选择套餐");
    expect(markup).toContain("阅读指南");
    expect(markup).not.toContain("Your workspace needs a plan");
  });

  it("localizes overview tiles, the funnel, and chart states", () => {
    const markup = chineseMarkup(
      <>
        <OverviewStrip overview={OVERVIEW} conversion={CONVERSION} />
        <FunnelPanel conversion={CONVERSION} segment={<span>30 天</span>} />
        <SignupsChart signups={[]} />
      </>,
    );

    expect(markup).toContain('aria-label="实例概览"');
    for (const label of ["付费", "试用中", "试用转付费", "注册"]) {
      expect(markup).toContain(`>${label}<`);
    }
    expect(markup).toContain("1 个将在周期结束时取消");
    expect(markup).toContain("3 天内将有 1 个试用结束");
    expect(markup).toContain("30 天内结束的 11 个试用中，有 4 个转付费");
    expect(markup).toContain('aria-label="注册到付费"');
    expect(markup).toContain(">步骤<");
    expect(markup).toContain(">占上一步<");
    expect(markup).toContain(">工作区<");
    expect(markup).toContain(">确认邮箱<");
    expect(markup).toContain("中位数：0.5 天到首个应用");
    expect(markup).toContain("过去 30 天注册人数太少，无法绘制图表。");
    expect(markup).not.toContain("Sign up to paid");
  });

  it("localizes the complete overview and conversion panels", () => {
    const overview = chineseMarkup(<AdminOverview />);
    const conversion = chineseMarkup(<AdminConversion />);

    expect(overview).toContain("过去 30 天的注册");
    expect(overview).toContain("需要关注");
    expect(overview).toContain("按阶段划分的工作区");
    expect(overview).toContain("按套餐和周期划分的付费工作区");
    expect(overview).toContain("实例总计");
    expect(overview).toContain("过去 30 天内离开");
    expect(overview).toContain("离开时所在阶段：付费 1 个。");
    expect(conversion).toContain("每周同期群");
    expect(conversion).toContain(">开始周<");
    expect(conversion).toContain(">仍付费<");
    expect(conversion).toContain("离开记录");
    expect(conversion).toContain("曾付费 · Ultimate");
    expect(conversion).toContain("价格太高");
  });

  it("localizes capacity, proxy health, and passes the translator to utilization status", () => {
    const markup = chineseMarkup(<AdminCapacity />);

    expect(markup).toContain("实例需求");
    expect(markup).toContain("1,520 / 36,000 次请求/天");
    expect(markup).toContain("4%");
    expect(markup).toContain("健康");
    expect(markup).toContain('aria-label="实例每日请求利用率"');
    expect(markup).toContain("主要消耗者");
    expect(markup).toContain("900 次请求/天");
    expect(markup).toContain("代理池");
    expect(markup).toContain("本月住宅回退");
    expect(markup).toContain("健康端点所剩无几");
    expect(markup).toContain("原始代理池健康状态");
    expect(markup).toContain("webshare");
    expect(markup).not.toContain("Instance daily request utilization");
    expect(markup).not.toContain("Healthy");
  });
});
