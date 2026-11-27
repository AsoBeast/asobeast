import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceChecklist } from "@asobeast/shared";
import type { Locale } from "@/lib/locale";
import { AddEmailAlertDialog } from "@/components/settings/AddEmailAlertDialog";
import { AddWebhookDialog } from "@/components/settings/AddWebhookDialog";
import { AlertChannelRow } from "@/components/settings/alert-channel/AlertChannelRow";
import { DeliveryCard } from "@/components/settings/DeliveryCard";
import { SettingsIndex } from "@/components/settings/SettingsIndex";
import { TeamCard } from "@/components/settings/TeamCard";
import { WorkspaceDeletionCard } from "@/components/settings/WorkspaceDeletionCard";
import { GoalPicker } from "@/components/checklist/GoalPicker";
import {
  alertDeliveryOptions,
  workspaceChecklistOptions,
  workspaceDeletionOptions,
  workspaceTeamOptions,
} from "@/lib/queries";
import { TestIntlProvider } from "@/test/intl-provider";

vi.mock("@/components/auth/use-auth", () => ({
  useAuth: () => ({
    authenticated: true,
    isLoading: false,
    isOperator: false,
    user: {
      id: "user-1",
      email: "owner@example.com",
      emailVerified: true,
      name: null,
      role: "owner",
      plan: "free",
      trialEndsAt: null,
      planExpiresAt: null,
      entitled: true,
      trialAwaitsCheckout: false,
      platformOperator: false,
      entryStep: null,
    },
  }),
}));

const CHECKLIST: WorkspaceChecklist = {
  goal: "improve_rankings",
  dismissedAt: null,
  items: [],
  done: 0,
  total: 0,
};

function localizedMarkup(
  node: React.ReactNode,
  locale: Locale = "zh-CN",
  seed?: (client: QueryClient) => void,
): string {
  const client = new QueryClient();
  seed?.(client);
  return renderToStaticMarkup(
    <TestIntlProvider locale={locale}>
      <QueryClientProvider client={client}>{node}</QueryClientProvider>
    </TestIntlProvider>,
  );
}

function chineseMarkup(
  node: React.ReactNode,
  seed?: (client: QueryClient) => void,
): string {
  return localizedMarkup(node, "zh-CN", seed);
}

function channelMarkup(locale: Locale, confirmDrops = false): string {
  return localizedMarkup(
    <AlertChannelRow
      label="alerts@example.com"
      channel="email"
      id="alert-1"
      events={["metadata.changed", "rank.dropped"]}
      rankDropThreshold={10}
      confirmDrops={confirmDrops}
      active
      activePending={false}
      onActiveChange={() => undefined}
      confirmTitle="Delete alert"
      confirmDescription="Stop sending"
      testPending={false}
      onTest={() => undefined}
      deletePending={false}
      onDelete={async () => undefined}
      eventsPending={false}
      onEventsSave={async () => undefined}
    />,
    locale,
  );
}

function ruleSpanTexts(markup: string): string[] {
  return [
    ...markup.matchAll(/<span data-slot="alert-rule">([^<]*)<\/span>/g),
  ].map((match) => match[1]);
}

function textContent(markup: string): string {
  return markup.replace(/<[^>]+>/g, "");
}

describe("Simplified Chinese settings surfaces", () => {
  it("renders the settings index headings in Chinese", () => {
    const markup = chineseMarkup(<SettingsIndex operator={false} />);

    expect(markup).toContain("本页");
    expect(markup).toContain("开始使用");
    expect(markup).toContain("提醒");
    expect(markup).toContain("团队");
    expect(markup).toContain("工作区");
    expect(markup).not.toContain("On this page");
  });

  it("renders the team heading and invite action in Chinese", () => {
    const markup = chineseMarkup(<TeamCard />, (client) => {
      client.setQueryData(workspaceTeamOptions.queryKey, {
        members: [
          {
            id: "user-1",
            email: "owner@example.com",
            name: null,
            role: "owner",
            createdAt: "2026-10-11T00:00:00.000Z",
          },
        ],
        invites: [],
      });
    });

    expect(markup).toContain("邀请成员");
    expect(markup).toContain("团队");
    expect(markup).toContain("所有者");
    expect(markup).toContain("owner@example.com");
    expect(markup).not.toContain("Invite member");
  });

  it("renders workspace deletion controls in Chinese", () => {
    const markup = chineseMarkup(<WorkspaceDeletionCard />, (client) => {
      client.setQueryData(workspaceDeletionOptions.queryKey, {
        scheduled: false,
        requestedAt: null,
        requestedBy: null,
        dueAt: null,
        graceDays: 7,
      });
    });

    expect(markup).toContain("删除工作区");
    expect(markup).toContain("7 天");
    expect(markup).not.toContain("Delete workspace");
  });

  it("renders the checklist goal question and choices in Chinese", () => {
    const markup = chineseMarkup(<GoalPicker />, (client) => {
      client.setQueryData(workspaceChecklistOptions.queryKey, CHECKLIST);
    });

    expect(markup).toContain("您想完成什么？");
    expect(markup).toContain("提升我的排名");
    expect(markup).toContain("研究一个想法");
    expect(markup).toContain("通过 AI 使用 AsoBeast");
    expect(markup).not.toContain("What would you like to get done?");
  });

  it("renders the add email alert action in Chinese", () => {
    const markup = chineseMarkup(<AddEmailAlertDialog />);

    expect(markup).toContain("添加邮件提醒");
    expect(markup).not.toContain("Add email alert");
  });

  it("renders the add webhook action in Chinese", () => {
    const markup = chineseMarkup(<AddWebhookDialog />);

    expect(markup).toContain("添加 Webhook");
    expect(markup).not.toContain("Add webhook");
  });

  it("renders channel actions and subscribed event labels in Chinese", () => {
    const markup = chineseMarkup(
      <AlertChannelRow
        label="alerts@example.com"
        channel="email"
        id="alert-1"
        events={["metadata.changed"]}
        confirmDrops
        active
        activePending={false}
        onActiveChange={() => undefined}
        confirmTitle="删除此邮件提醒？"
        confirmDescription="停止发送"
        testPending={false}
        onTest={() => undefined}
        deletePending={false}
        onDelete={async () => undefined}
        eventsPending={false}
        onEventsSave={async () => undefined}
      />,
    );

    expect(markup).toContain("发送测试");
    expect(markup).toContain("最近投递");
    expect(textContent(markup)).toContain("发送：元数据变化");
    expect(markup).toContain("切换 alerts@example.com");
    expect(markup).not.toContain("Send test");
  });

  it("renders one stable English span per subscribed rule with locale-aware list parts", () => {
    const markup = channelMarkup("en");

    expect(ruleSpanTexts(markup)).toEqual([
      "Metadata changed",
      "Rank dropped · 10+",
    ]);
    expect(textContent(markup)).toContain(
      "Sends Metadata changed and Rank dropped · 10+",
    );
  });

  it("renders one stable Chinese span per subscribed rule with locale-aware list parts", () => {
    const markup = channelMarkup("zh-CN");

    expect(ruleSpanTexts(markup)).toEqual(["元数据变化", "排名下降 · 10+"]);
    expect(textContent(markup)).toContain("发送：元数据变化和排名下降 · 10+");
  });

  it("keeps the confirmation badge beside one span per subscribed rule", () => {
    const markup = channelMarkup("en", true);

    expect(ruleSpanTexts(markup)).toEqual([
      "Confirmed drops",
      "Metadata changed",
      "Rank dropped · 10+",
    ]);
  });

  it("renders delivery mode and status fields in Chinese", () => {
    const markup = chineseMarkup(<DeliveryCard />, (client) => {
      client.setQueryData(alertDeliveryOptions.queryKey, {
        mode: "instant",
        pipelineCron: "*/5 * * * *",
        trigger: "daily_pipeline_completion",
        lastFlushAt: null,
        pending: 2,
        claimed: 1,
      });
    });

    expect(markup).toContain("投递");
    expect(markup).toContain("即时");
    expect(markup).toContain("从未");
    expect(markup).toContain("待处理");
    expect(markup).toContain("已领取");
    expect(markup).toContain("*/5 * * * *");
    expect(markup).not.toContain("Instant");
  });
});
