import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PLANS, type AccountPlan } from "@asobeast/shared";
import { AccountNotice } from "@/components/auth/AccountNotice";
import { MemberBilling } from "@/components/auth/MemberBilling";
import { BillingWall } from "@/components/billing/BillingWall";
import { PlanCard } from "@/components/settings/PlanCard";
import { accountPlanOptions } from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";

vi.mock("nuqs", () => ({
  useQueryState: () => ["indie", () => undefined],
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

vi.mock("@/components/billing/use-viewer-clock", () => ({
  useViewerClock: () => ({
    now: new Date("2026-10-22T12:00:00.000Z"),
    timeZone: "UTC",
  }),
}));

vi.mock("@/components/auth/use-auth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "owner@example.com",
      emailVerified: true,
      name: null,
      role: "owner",
      plan: "free",
      trialEndsAt: null,
      planExpiresAt: null,
      entitled: false,
      trialAwaitsCheckout: false,
      platformOperator: false,
      entryStep: "choose-plan",
    },
    trialOnly: false,
    trialing: false,
    isMember: false,
    isOwner: true,
  }),
}));

const PLAN: AccountPlan = {
  plan: "indie",
  displayName: "Ignored API display name",
  billing: true,
  entitled: true,
  hasBillingAccount: true,
  subscribed: true,
  cancelAtPeriodEnd: false,
  trialOffer: null,
  trialEndsAt: null,
  renewsAt: "2026-11-22T00:00:00.000Z",
  upgradeTo: "ultimate",
  upgradePath: "/upgrade?plan=ultimate",
  limits: PLANS.indie.limits,
  usage: {
    apps: { used: 1, limit: 5 },
    keywordMarkets: { used: 20, limit: 1_000 },
    aiCalls: { used: 3, limit: 200, resetsAt: "2026-11-01T00:00:00.000Z" },
  },
};
const OFFERED: AccountPlan = {
  ...PLAN,
  plan: "free",
  entitled: false,
  hasBillingAccount: false,
  subscribed: false,
  trialOffer: { days: 7 },
  renewsAt: null,
  upgradeTo: "indie",
  upgradePath: "/upgrade?plan=indie",
};

function chineseMarkup(
  node: React.ReactNode,
  client = new QueryClient(),
): string {
  return renderToStaticMarkup(
    <TestIntlProvider locale="zh-CN">
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </TestIntlProvider>,
  );
}

function billingWallMarkup(): string {
  return chineseMarkup(
    <BillingWall
      user={undefined}
      plan={OFFERED}
      catalog={{ enabled: true, prices: [] }}
      catalogRead={null}
      billing
    />,
  );
}

describe("Simplified Chinese billing and account components", () => {
  it("renders the paywall heading in Chinese", () => {
    const markup = billingWallMarkup();

    expect(markup).toContain("开启 7 天免费试用");
    expect(markup).not.toContain("Start your 7 day free trial");
  });

  it("renders the selected plan action in Chinese", () => {
    const markup = billingWallMarkup();

    expect(markup).toContain("今天支付 US$0，开启免费试用");
    expect(markup).not.toContain("Pay $0 today");
  });

  it("renders trial status in Chinese", () => {
    const markup = billingWallMarkup();

    expect(markup).toContain("您的试用将于 2026年10月29日 结束");
    expect(markup).not.toContain("Your trial ends on");
  });

  it("renders the order summary in Chinese", () => {
    const markup = billingWallMarkup();

    expect(markup).toContain("订单摘要");
    expect(markup).toContain("今日应付");
    expect(markup).toContain("US$0.00");
    expect(markup).not.toContain("Order summary");
  });

  it("renders FAQ questions and answers in Chinese", () => {
    const markup = billingWallMarkup();

    expect(markup).toContain("今天会扣费吗？");
    expect(markup).toContain("如何取消？");
    expect(markup).not.toContain("How do I cancel?");
  });

  it("renders checkout and payment copy in Chinese", () => {
    const markup = billingWallMarkup();

    expect(markup).toContain("付款");
    expect(markup).toContain("安全支付由 Stripe 处理。");
    expect(markup).toContain("今天支付 US$0，开启免费试用");
    expect(markup).not.toContain("Secure payments processed by Stripe.");
  });

  it("renders the account plan notice and its action in Chinese", () => {
    const markup = chineseMarkup(<AccountNotice />);

    expect(markup).toContain("数据采集已暂停。");
    expect(markup).toContain("选择套餐");
    expect(markup).not.toContain("Collection is paused");
  });

  it("renders the settings plan, usage, and billing controls in Chinese", () => {
    const client = new QueryClient();
    client.setQueryData(accountPlanOptions.queryKey, PLAN);
    const markup = chineseMarkup(<PlanCard />, client);

    expect(markup).toContain("套餐");
    expect(markup).toContain("独立版");
    expect(markup).toContain("关键词市场");
    expect(markup).toContain("1 / 5");
    expect(markup).toContain("管理账单");
    expect(markup).not.toContain("Manage billing");
  });

  it("renders member billing guidance in Chinese", () => {
    const markup = chineseMarkup(<MemberBilling plan={PLAN} />);

    expect(markup).toContain("由工作区所有者管理账单");
    expect(markup).toContain("返回您的应用");
    expect(markup).not.toContain("Your workspace owner manages billing");
  });
});
