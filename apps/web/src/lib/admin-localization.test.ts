import { describe, expect, it } from "vitest";
import type { SupportWorkspaceSummary } from "@asobeast/shared";
import {
  departuresTitle,
  funnelRows,
  medianLine,
  unrecordedNote,
} from "./admin-conversion";
import {
  departureReasonLabel,
  payingPlanLabel,
  stageLabel,
} from "./admin-stages";
import {
  dailyRunDone,
  onDemandRows,
  queueLabel,
  supportActionLabel,
  supportOutcomeLabel,
  usageLine,
  usageRows,
} from "./admin-support";
import {
  standingOf,
  workspaceFacts,
} from "@/components/admin/workspace-sheet/workspace-facts";
import { adminNounLabel } from "@/components/admin/admin-search";
import { translationContext } from "@/test/translation-context";

const zh = translationContext("zh-CN", "admin");
const en = translationContext("en", "admin");

const WORKSPACE: SupportWorkspaceSummary = {
  workspaceId: "ws_ana",
  name: "Ana Apps",
  operatorWorkspace: false,
  plan: "indie",
  storedPlan: "indie",
  createdAt: "2026-10-30T09:00:00.000Z",
  suspendedAt: null,
  suspendedReason: null,
  trialEndsAt: null,
  planExpiresAt: "2026-12-04T00:00:00.000Z",
  subscriptionStatus: "past_due",
  billingInterval: "month",
  hasSubscription: true,
  members: 2,
  apps: 2,
  competitors: 3,
  keywordMarkets: 40,
  stage: "paying",
};

const LIMITS = {
  apps: 5,
  keywordMarkets: 1_000,
  competitorsPerApp: 10,
  chartFollows: 10,
  aiCallsPerMonth: 200,
  apiRequestsPerMinute: 300,
  apiWritesPerMinute: 60,
  apiRequestsPerDay: 40_000,
  apiConcurrentRequests: 16,
  mcpRequestsPerMinute: 60,
  onDemand: null,
};

describe("Admin ICU plurals and composites", () => {
  it("uses ICU plurals for English counts and nouns", () => {
    expect(en.translator("overview.trialsEnding", { count: 1, days: 3 })).toBe(
      "1 trial ends within 3 days",
    );
    expect(en.translator("overview.trialsEnding", { count: 2, days: 3 })).toBe(
      "2 trials end within 3 days",
    );
    expect(en.translator("capacity.requestsPerDay", { count: 1 })).toBe(
      "1 request/day",
    );
    expect(en.translator("capacity.requestsPerDay", { count: 2 })).toBe(
      "2 requests/day",
    );
    expect(en.translator("capacity.requestsPerDay", { count: 1_000 })).toBe(
      "1,000 requests/day",
    );
    expect(adminNounLabel("account", 1, en.translator)).toBe("account");
    expect(adminNounLabel("account", 2, en.translator)).toBe("accounts");
    expect(adminNounLabel("workspace", 1, en.translator)).toBe("workspace");
    expect(adminNounLabel("workspace", 2, en.translator)).toBe("workspaces");
    expect(adminNounLabel("app", 1, en.translator)).toBe("app");
    expect(adminNounLabel("app", 2, en.translator)).toBe("apps");
  });

  it("lets English and Chinese ICU messages reorder composite fragments", () => {
    expect(
      en.translator("support.stageWithPlan", {
        stage: "Paying",
        plan: "Indie",
      }),
    ).toBe("Paying · Indie");
    expect(
      zh.translator("support.stageWithPlan", {
        stage: "付费",
        plan: "Indie",
      }),
    ).toBe("Indie · 付费");
    expect(
      en.translator("conversion.departureStage", {
        count: 1,
        stage: "paying",
      }),
    ).toBe("1 paying");
    expect(
      zh.translator("conversion.departureStage", {
        count: 1,
        stage: "付费",
      }),
    ).toBe("付费 1 个");
    expect(
      en.translator("conversion.departureStages", { stages: "1 paying" }),
    ).toBe("By stage when they asked to leave: 1 paying.");
    expect(
      zh.translator("conversion.departureStages", { stages: "付费 1 个" }),
    ).toBe("离开时所在阶段：付费 1 个。");
    expect(
      en.translator("conversion.departures.paidPlan", {
        plan: "Ultimate",
        paidBefore: "paid before",
      }),
    ).toBe("Ultimate · paid before");
    expect(
      zh.translator("conversion.departures.paidPlan", {
        plan: "Ultimate",
        paidBefore: "曾付费",
      }),
    ).toBe("曾付费 · Ultimate");
  });
});

describe("Simplified Chinese admin helpers", () => {
  it("maps funnel codes and median copy to Chinese", () => {
    expect(
      funnelRows(
        [
          { key: "signed-up", count: 11 },
          { key: "confirmed-email", count: 9 },
          { key: "trial-started", count: 7 },
          { key: "first-app", count: 6 },
          { key: "ranked-within-a-day", count: 4 },
          { key: "paid", count: 2 },
        ],
        zh.translator,
      ).map((row) => row.label),
    ).toEqual([
      "注册",
      "确认邮箱",
      "开始试用",
      "导入首个应用",
      "一天内获得排名",
      "付费",
    ]);
    expect(
      medianLine(
        { signupToFirstApp: 0.5, signupToTrial: 1.5, trialToPaid: 7 },
        zh.translator,
      ),
    ).toBe("中位数：0.5 天到首个应用 · 1.5 天到试用 · 7 天从试用到付费");
    expect(
      unrecordedNote("2026-11-15", 30, "2026-11-20T10:00:00.000Z", zh),
    ).toBe("在 11月15日 之前删除的工作区不计入。");
    expect(departuresTitle(30, zh.translator)).toBe("过去 30 天内离开");
  });

  it("maps workspace stages, plans, flags, and departure reasons to Chinese", () => {
    expect(stageLabel("trialing", "indie", zh.translator)).toBe("试用中");
    expect(payingPlanLabel("indie", "month", zh.translator)).toBe(
      "Indie · 按月续订",
    );
    expect(payingPlanLabel("indie", null, zh.translator)).toBe(
      "Indie · 未记录周期",
    );
    expect(departureReasonLabel("too-expensive", zh.translator)).toBe(
      "价格太高",
    );
    expect(departureReasonLabel("unanswered", zh.translator)).toBe("未回答");
  });

  it("localizes usage and allowance rows while preserving counts", () => {
    expect(usageLine(3, 10, zh)).toBe("3 / 10");
    expect(usageLine(12, null, zh)).toBe("12，无限制");
    expect(
      usageRows(
        LIMITS,
        { members: 2, apps: 2, competitors: 3, keywordMarkets: 40 },
        zh,
      ).slice(0, 4),
    ).toEqual([
      { label: "成员", value: "2" },
      { label: "应用", value: "2 / 5" },
      { label: "关键词市场", value: "40 / 1,000" },
      { label: "竞品", value: "共 3 个，每个应用最多 10 个" },
    ]);
    expect(
      onDemandRows(
        {
          refresh: { limit: 50, windowSeconds: 86_400 },
          runDaily: { limit: 5, windowSeconds: 86_400 },
          score: { limit: 100, windowSeconds: 86_400 },
          suggestions: { limit: 60, windowSeconds: 3_600 },
          spider: { limit: 12, windowSeconds: 86_400 },
          importApp: { limit: 10, windowSeconds: 86_400 },
          addCompetitor: { limit: 60, windowSeconds: 86_400 },
          storeLookup: { limit: 60, windowSeconds: 3_600 },
          chartCapture: { limit: 30, windowSeconds: 86_400 },
        },
        zh,
      ).slice(0, 2),
    ).toEqual([
      { label: "刷新", value: "每天 50 次" },
      { label: "每日运行", value: "每天 5 次" },
    ]);
  });

  it("localizes support enums and completion toasts", () => {
    expect(supportActionLabel("view", zh.translator)).toBe("已查看");
    expect(supportOutcomeLabel("succeeded", zh.translator)).toBe("成功");
    expect(queueLabel("appstore", zh.translator)).toBe("App Store");
    expect(queueLabel("custom", zh.translator)).toBe("custom");
    expect(
      dailyRunDone("Ana Apps", "queued 0 apps, 0 keywords", zh.translator),
    ).toBe("今天没有新的任务可为 Ana Apps 排队。");
    expect(dailyRunDone("Ana Apps", "queued", zh.translator)).toBe(
      "已为 Ana Apps 排队每日运行。",
    );
  });

  it("localizes support facts and dates without translating API status codes", () => {
    expect(standingOf(WORKSPACE, zh)).toBe("Indie · 付费");
    expect(workspaceFacts(WORKSPACE, zh)).toEqual([
      { label: "阶段", value: "Indie · 付费" },
      { label: "创建时间", value: "2026年10月30日" },
      { label: "订阅", value: "past_due，每月续订" },
      { label: "周期结束", value: "2026年12月4日" },
    ]);
  });
});
