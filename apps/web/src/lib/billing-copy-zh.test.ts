import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import type { AccountPlan } from "@asobeast/shared";
import zhBilling from "../../messages/zh-CN/billing.json";
import { aiAllowanceRefusal, aiCallsLeftText } from "./ai-allowance";
import { trialStartedToast } from "./checkout-return";
import { summaryFromCatalog } from "./order-summary";
import { paywallFaq } from "./paywall-faq";
import {
  paywallHeading,
  paywallStatusLine,
  planActionLabel,
  planStatusLine,
  trialBannerLine,
  trialPriceLabel,
} from "./plan-choice";
import { planInForceLabel } from "./plan-in-force";
import { formatQuotaUsage } from "./quota-usage";

const CLOCK = { now: new Date("2026-10-22T12:00:00.000Z"), timeZone: "UTC" };
const CONTEXT = {
  locale: "zh-CN" as const,
  translator: createTranslator({
    locale: "zh-CN",
    namespace: "billing",
    messages: { billing: zhBilling },
    timeZone: "UTC",
  }),
};

const OFFERED: AccountPlan = {
  plan: "free",
  displayName: "Ignored API display name",
  billing: true,
  entitled: false,
  hasBillingAccount: false,
  subscribed: false,
  cancelAtPeriodEnd: false,
  trialOffer: { days: 7 },
  trialEndsAt: null,
  renewsAt: null,
  upgradeTo: "indie",
  upgradePath: "/upgrade?plan=indie",
  limits: {
    apps: 5,
    keywordMarkets: 1_000,
    competitorsPerApp: 10,
    chartFollows: 10,
    apiRequestsPerMinute: 300,
    apiWritesPerMinute: 60,
    apiRequestsPerDay: 40_000,
    apiConcurrentRequests: 16,
    mcpRequestsPerMinute: 60,
    aiCallsPerMonth: 200,
    onDemand: null,
  },
  usage: {
    apps: { used: 1, limit: 5 },
    keywordMarkets: { used: 20, limit: 1_000 },
  },
};

const TRIALING: AccountPlan = {
  ...OFFERED,
  plan: "indie",
  entitled: true,
  subscribed: true,
  trialing: true,
  trialOffer: null,
  billingInterval: "month",
  trialEndsAt: "2026-10-27T00:00:00.000Z",
  renewsAt: "2026-10-27T00:00:00.000Z",
};

const TERMS = "每月 US$10，外加适用的增值税或销售税，按月续费，直到您取消为止";

describe("Simplified Chinese billing copy", () => {
  it("localizes the paywall heading from the stable trial code", () => {
    expect(paywallHeading(OFFERED, CONTEXT)).toBe("开启 7 天免费试用");
    expect(paywallHeading(undefined, CONTEXT)).toBe("不受限制地持续优化");
  });

  it("localizes plan actions without translating API display names", () => {
    expect(planActionLabel("checkout", "indie", CONTEXT)).toBe("选择独立版");
    expect(planActionLabel("trial", "indie", CONTEXT)).toBe(
      "今天支付 US$0，开启免费试用",
    );
    expect(planActionLabel("resume", "indie", CONTEXT)).toBe(
      "在账单门户中恢复订阅",
    );
  });

  it("localizes trial status, countdown, price, and renewal copy", () => {
    expect(paywallStatusLine(OFFERED, CLOCK, CONTEXT)).toContain(
      "您的试用将于 2026年10月29日 结束",
    );
    expect(planStatusLine(TRIALING, CONTEXT)).toBe(
      "试用至 2026年10月27日，之后每月 US$10。",
    );
    expect(trialBannerLine(1, TRIALING, CONTEXT)).toBe(
      "试用还剩 1 天，之后为独立版，每月 US$10。",
    );
    expect(trialPriceLabel(TRIALING, CONTEXT)).toBe("每月 US$10");
  });

  it("localizes the order summary and locale-formats US dollars", () => {
    expect(
      summaryFromCatalog(
        "indie",
        "month",
        { days: 7 },
        {
          ...CONTEXT,
          clock: CLOCK,
        },
      ),
    ).toEqual({
      planName: "独立版",
      intervalLabel: "按月",
      unitAmount: "US$10.00",
      dueToday: "US$0.00",
      thenLine: `2026年10月29日起：${TERMS}。`,
      cancelLine: "可随时在设置中取消。在上述日期之前不会扣费。",
    });
  });

  it("localizes FAQ questions and answers", () => {
    const items = paywallFaq({ days: 7 }, TERMS, CLOCK, CONTEXT);

    expect(items[0]).toEqual({
      id: "charge",
      question: "今天会扣费吗？",
      answer:
        "不会。今天仅验证您的银行卡，不会扣费。2026年10月29日起：每月 US$10，外加适用的增值税或销售税，按月续费，直到您取消为止。请在之前从设置中取消，这样不会扣费。",
    });
    expect(items[1]?.question).toBe("如何取消？");
  });

  it("localizes the checkout return toast", () => {
    expect(trialStartedToast(TRIALING, CONTEXT)).toBe(
      "您的免费试用已开始。首次扣费日期为 2026年10月27日。",
    );
  });

  it("localizes plan, quota, and AI allowance labels from stable codes", () => {
    expect(
      planInForceLabel(
        { plan: "indie", trialEndsAt: null, planExpiresAt: null },
        CLOCK.now,
        CONTEXT,
      ),
    ).toBe("独立版");
    expect(
      formatQuotaUsage({ used: 1_240, limit: 10_000 }, "tracked", CONTEXT),
    ).toBe("1,240 / 10,000");
    expect(formatQuotaUsage({ used: 1, limit: 0 }, "tracked", CONTEXT)).toBe(
      "1 个已跟踪，套餐未包含",
    );
    expect(
      aiAllowanceRefusal(
        {
          plan: "indie",
          limit: 1,
          used: 1,
          resetsAt: "2026-11-01T00:00:00.000Z",
          upgradeTo: "ultimate",
        },
        CONTEXT,
      ),
    ).toBe("此工作区本月已用完套餐包含的 1 次 AI 调用。2026年11月1日 续期。");
    expect(
      aiCallsLeftText(
        { used: 37, limit: 200, resetsAt: "2026-11-01T00:00:00.000Z" },
        CONTEXT,
      ),
    ).toBe("本月还剩 163 / 200 次 AI 调用");
  });
});
